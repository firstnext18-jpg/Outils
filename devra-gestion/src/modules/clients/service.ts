import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { clientDisplayName } from "@/domain/clients";
import { searchWords } from "@/domain/search";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db, type Tx } from "@/server/db";
import type { CurrentUser } from "@/server/session";
import { withComputedColumns } from "@/modules/clients/computed-columns";
import type { ClientData, ClientListParams, ClientSort } from "@/modules/clients/schemas";

export const CLIENTS_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Liste
// ---------------------------------------------------------------------------

export function buildClientWhere(params: ClientListParams): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput[] = [];
  const status = params.statut ?? "actifs";
  if (status === "actifs") where.push({ archivedAt: null });
  if (status === "archives") where.push({ archivedAt: { not: null } });
  if (params.type) where.push({ kind: params.type === "entreprise" ? "COMPANY" : "INDIVIDUAL" });
  if (params.canton) where.push({ canton: params.canton });
  if (params.site) where.push({ siteTypeId: params.site });
  if (params.tag) where.push({ tags: { has: params.tag } });
  // Chaque mot doit apparaître dans le texte de recherche (nom, email, localité…).
  for (const word of searchWords(params.q ?? "")) where.push({ searchText: { contains: word } });
  return { AND: where };
}

const ORDER_BY: Record<ClientSort, Prisma.ClientOrderByWithRelationInput[]> = {
  nom: [{ sortName: "asc" }],
  "-nom": [{ sortName: "desc" }],
  recent: [{ createdAt: "desc" }],
  ancien: [{ createdAt: "asc" }],
  localite: [{ city: "asc" }, { sortName: "asc" }],
};

const listSelect = {
  id: true,
  kind: true,
  displayName: true,
  contactName: true,
  email: true,
  phone: true,
  postalCode: true,
  city: true,
  canton: true,
  country: true,
  tags: true,
  archivedAt: true,
  siteType: { select: { name: true } },
} satisfies Prisma.ClientSelect;

export type ClientListRow = Prisma.ClientGetPayload<{ select: typeof listSelect }>;

export async function listClients(params: ClientListParams) {
  const where = buildClientWhere(params);
  const total = await db.client.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE));
  const page = Math.min(params.page ?? 1, pageCount);
  const clients = await db.client.findMany({
    where,
    orderBy: ORDER_BY[params.tri ?? "nom"],
    skip: (page - 1) * CLIENTS_PAGE_SIZE,
    take: CLIENTS_PAGE_SIZE,
    select: listSelect,
  });
  return { clients, total, page, pageCount };
}

/** Nombre total de clients (pour distinguer « aucun client » de « aucun résultat »). */
export function countAllClients() {
  return db.client.count();
}

/** Valeurs proposées dans les filtres : types de sites et tags existants. */
export async function getClientFilterOptions() {
  const [siteTypes, tagRows] = await Promise.all([
    db.siteType.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    db.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT unnest(tags) AS tag FROM client ORDER BY tag`,
  ]);
  return { siteTypes, tags: tagRows.map((row) => row.tag) };
}

/** Clients pour l'export (mêmes filtres que la liste, sans pagination). */
export function listClientsForExport(params: ClientListParams) {
  return db.client.findMany({
    where: buildClientWhere(params),
    orderBy: ORDER_BY[params.tri ?? "nom"],
    include: { siteType: { select: { name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Fiche
// ---------------------------------------------------------------------------

export function getClient(id: string) {
  return db.client.findUnique({
    where: { id },
    include: {
      siteType: { select: { id: true, name: true, active: true } },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClient>>>;

export function getClientActivity(id: string, take = 20) {
  return db.activityLog.findMany({
    where: { entityType: "client", entityId: id },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      details: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Création, modification
// ---------------------------------------------------------------------------

/** Vérifie que le type de site choisi existe (il peut avoir été supprimé entre-temps). */
async function assertSiteType(client: Tx | typeof db, siteTypeId: string | null) {
  if (siteTypeId && !(await client.siteType.findUnique({ where: { id: siteTypeId } }))) {
    throw new UserError("Le type de site choisi n'existe plus. Rechargez la page.");
  }
}

export async function createClient(actor: CurrentUser, data: ClientData) {
  await assertSiteType(db, data.siteTypeId);
  return db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: { ...withComputedColumns(data), createdById: actor.id, updatedById: actor.id },
    });
    await logActivity(
      {
        userId: actor.id,
        action: "client.created",
        entityType: "client",
        entityId: client.id,
        label: client.displayName,
      },
      tx,
    );
    return client;
  });
}

/** Libellés des champs, pour le journal (« a modifié : adresse, email »). */
const FIELD_LABELS: Partial<Record<keyof ClientData, string>> = {
  kind: "type",
  firstName: "prénom",
  lastName: "nom",
  companyName: "raison sociale",
  contactName: "personne de contact",
  street: "adresse",
  streetNumber: "adresse",
  postalCode: "adresse",
  city: "adresse",
  canton: "canton",
  country: "pays",
  email: "email",
  phone: "téléphone",
  website: "site internet",
  siteTypeId: "type de site",
  language: "langue",
  notes: "notes",
  tags: "tags",
};

function changedFields(before: Record<keyof ClientData, unknown>, after: ClientData): string[] {
  const labels = new Set<string>();
  for (const key of Object.keys(FIELD_LABELS) as (keyof ClientData)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) labels.add(FIELD_LABELS[key]!);
  }
  return [...labels];
}

/**
 * Modification avec verrouillage optimiste : la mise à jour n'a lieu que si la
 * fiche n'a pas changé depuis son ouverture (même numéro de version).
 */
export async function updateClient(
  actor: CurrentUser,
  id: string,
  version: number,
  data: ClientData,
) {
  const before = await db.client.findUnique({ where: { id } });
  if (!before) throw new UserError("Ce client n'existe plus.");
  await assertSiteType(db, data.siteTypeId);

  await db.$transaction(async (tx) => {
    const result = await tx.client.updateMany({
      where: { id, version },
      data: { ...withComputedColumns(data), updatedById: actor.id, version: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new UserError(
        "Cette fiche a été modifiée par quelqu'un d'autre entre-temps. Rechargez la page pour voir la dernière version, puis refaites vos changements.",
      );
    }
    const fields = changedFields(before, data);
    await logActivity(
      {
        userId: actor.id,
        action: "client.updated",
        entityType: "client",
        entityId: id,
        label: clientDisplayName(data),
        details: { fields },
      },
      tx,
    );
  });
}

export async function setClientArchived(actor: CurrentUser, id: string, archived: boolean) {
  const client = await db.client.findUnique({ where: { id } });
  if (!client) throw new UserError("Ce client n'existe plus.");
  if (Boolean(client.archivedAt) === archived) return;
  await db.$transaction(async (tx) => {
    await tx.client.update({
      where: { id },
      data: {
        archivedAt: archived ? new Date() : null,
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    await logActivity(
      {
        userId: actor.id,
        action: archived ? "client.archived" : "client.unarchived",
        entityType: "client",
        entityId: id,
        label: client.displayName,
      },
      tx,
    );
  });
}

/**
 * Suppression définitive. Un client lié à des devis ou des factures ne pourra
 * pas être supprimé (contrainte de la base, à partir des phases 4 et 5) : il
 * faudra l'archiver.
 */
export async function deleteClient(actor: CurrentUser, id: string) {
  const client = await db.client.findUnique({ where: { id } });
  if (!client) throw new UserError("Ce client n'existe plus.");
  await db.$transaction(async (tx) => {
    await tx.client.delete({ where: { id } });
    await logActivity(
      {
        userId: actor.id,
        action: "client.deleted",
        entityType: "client",
        entityId: id,
        label: client.displayName,
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------------------
// Recherche globale et export nLPD
// ---------------------------------------------------------------------------

export function searchClients(query: string, take = 8) {
  const words = searchWords(query);
  if (words.length === 0) return Promise.resolve([]);
  return db.client.findMany({
    where: { AND: words.map((word) => ({ searchText: { contains: word } })) },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortName: "asc" }],
    take,
    select: { id: true, displayName: true, city: true, email: true, archivedAt: true },
  });
}

/**
 * Toutes les données enregistrées sur un client (droit d'accès, nLPD).
 * Les devis, factures et paiements s'ajouteront avec les phases suivantes.
 */
export async function exportClientData(actor: CurrentUser, id: string) {
  const client = await db.client.findUnique({
    where: { id },
    include: {
      siteType: { select: { name: true } },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });
  if (!client) return null;
  const activity = await db.activityLog.findMany({
    where: { entityType: "client", entityId: id },
    orderBy: { createdAt: "asc" },
    select: { action: true, createdAt: true, details: true, user: { select: { name: true } } },
  });
  await logActivity({
    userId: actor.id,
    action: "client.data_exported",
    entityType: "client",
    entityId: id,
    label: client.displayName,
  });

  const {
    sortName: _sortName,
    searchText: _searchText,
    siteTypeId: _siteTypeId,
    ...fields
  } = client;
  return {
    exportedAt: new Date().toISOString(),
    exportedBy: actor.name,
    client: {
      ...fields,
      siteType: client.siteType?.name ?? null,
      createdBy: client.createdBy?.name ?? null,
      updatedBy: client.updatedBy?.name ?? null,
    },
    activity: activity.map((entry) => ({
      date: entry.createdAt.toISOString(),
      action: entry.action,
      user: entry.user?.name ?? null,
      details: entry.details,
    })),
  };
}
