import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { clientIndicators, NO_STAGE_FILTER, type ClientIndicator } from "@/domain/client-stage";
import { clientDisplayName } from "@/domain/clients";
import { isoToDbDate, todayIso } from "@/domain/dates";
import { searchWords } from "@/domain/search";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db, type Tx } from "@/server/db";
import type { CurrentUser } from "@/server/session";
import { withComputedColumns } from "@/modules/clients/computed-columns";
import { clientStorageNames } from "@/modules/files/service";
import { deleteStoredFiles } from "@/server/files";
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
  if (params.etat) where.push(stageWhere(params.etat));
  // Chaque mot doit apparaître dans le texte de recherche (nom, email, localité…).
  for (const word of searchWords(params.q ?? "")) where.push({ searchText: { contains: word } });
  return { AND: where };
}

/** Factures émises, pas entièrement payées, dont l'échéance est dépassée. */
function overdueInvoiceWhere(): Prisma.InvoiceWhereInput {
  return { status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: isoToDbDate(todayIso()) } };
}

/** Devis acceptés qui n'ont encore aucune facture. */
const acceptedNotInvoiced: Prisma.QuoteWhereInput = { status: "ACCEPTED", invoices: { none: {} } };

function stageWhere(etat: string): Prisma.ClientWhereInput {
  switch (etat) {
    case NO_STAGE_FILTER:
      return { stageId: null };
    case "devis-a-accepter":
      return { quotes: { some: { status: "SENT" } } };
    case "facture-a-envoyer":
      return {
        OR: [
          { invoices: { some: { status: "DRAFT" } } },
          { quotes: { some: acceptedNotInvoiced } },
        ],
      };
    case "facture-en-retard":
      return { invoices: { some: overdueInvoiceWhere() } };
    default:
      return { stageId: etat };
  }
}

/** Indicateurs automatiques (devis à accepter, facture à envoyer, en retard) de ces clients. */
export async function clientIndicatorsFor(
  clientIds: string[],
): Promise<Map<string, ClientIndicator[]>> {
  if (clientIds.length === 0) return new Map();
  const inClients = { clientId: { in: clientIds } };
  const [sent, drafts, accepted, overdue] = await Promise.all([
    db.quote.groupBy({ by: ["clientId"], where: { ...inClients, status: "SENT" }, _count: true }),
    db.invoice.groupBy({
      by: ["clientId"],
      where: { ...inClients, status: "DRAFT" },
      _count: true,
    }),
    db.quote.groupBy({
      by: ["clientId"],
      where: { ...inClients, ...acceptedNotInvoiced },
      _count: true,
    }),
    db.invoice.groupBy({
      by: ["clientId"],
      where: { ...inClients, ...overdueInvoiceWhere() },
      _count: true,
    }),
  ]);
  const count = (rows: { clientId: string; _count: number }[], id: string) =>
    rows.find((row) => row.clientId === id)?._count ?? 0;
  return new Map(
    clientIds.map((id) => [
      id,
      clientIndicators({
        sentQuotes: count(sent, id),
        toInvoice: count(drafts, id) + count(accepted, id),
        overdueInvoices: count(overdue, id),
      }),
    ]),
  );
}

/** Change l'état du client (liste des paramètres) ; `null` : aucun état. */
export async function setClientStage(actor: CurrentUser, id: string, stageId: string | null) {
  const client = await db.client.findUnique({
    where: { id },
    select: { displayName: true, stageId: true, stage: { select: { name: true } } },
  });
  if (!client) throw new UserError("Ce client n'existe plus.");
  if (client.stageId === stageId) return;
  const stage = stageId
    ? await db.listItem.findFirst({ where: { id: stageId, kind: "CLIENT_STAGE" } })
    : null;
  if (stageId && !stage) throw new UserError("Cet état n'existe plus. Rechargez la page.");
  await db.client.update({ where: { id }, data: { stageId } });
  await logActivity({
    userId: actor.id,
    action: "client.stage_changed",
    entityType: "client",
    entityId: id,
    label: client.displayName,
    details: { from: client.stage?.name ?? null, to: stage?.name ?? null },
  });
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
  stage: { select: { name: true } },
} satisfies Prisma.ClientSelect;

export type ClientListRow = Prisma.ClientGetPayload<{ select: typeof listSelect }> & {
  indicators: ClientIndicator[];
};

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
  const indicators = await clientIndicatorsFor(clients.map((c) => c.id));
  return {
    clients: clients.map((client) => ({ ...client, indicators: indicators.get(client.id) ?? [] })),
    total,
    page,
    pageCount,
  };
}

/** Nombre total de clients (pour distinguer « aucun client » de « aucun résultat »). */
export function countAllClients() {
  return db.client.count();
}

/** Valeurs proposées dans les filtres : types de sites et tags existants. */
export async function getClientFilterOptions() {
  const [siteTypes, stages, tagRows] = await Promise.all([
    db.siteType.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    db.listItem.findMany({
      where: { kind: "CLIENT_STAGE" },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    db.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT unnest(tags) AS tag FROM client ORDER BY tag`,
  ]);
  return { siteTypes, stages, tags: tagRows.map((row) => row.tag) };
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
      stage: { select: { id: true, name: true } },
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
 * Suppression définitive, seulement pour un client sans devis ni facture
 * (sinon : archivage). La base le garantit aussi (clé étrangère « Restrict »).
 */
export async function deleteClient(actor: CurrentUser, id: string) {
  const client = await db.client.findUnique({
    where: { id },
    include: { _count: { select: { quotes: true, invoices: true, subscriptions: true } } },
  });
  if (!client) throw new UserError("Ce client n'existe plus.");
  if (client._count.subscriptions > 0) {
    throw new UserError(
      "Ce client a des abonnements : il ne peut pas être supprimé. Archivez-le plutôt.",
    );
  }
  if (client._count.invoices > 0) {
    throw new UserError(
      `Ce client a ${client._count.invoices} facture${client._count.invoices > 1 ? "s" : ""} : il ne peut pas être supprimé. Archivez-le plutôt.`,
    );
  }
  if (client._count.quotes > 0) {
    throw new UserError(
      `Ce client a ${client._count.quotes} devis : il ne peut pas être supprimé. Archivez-le plutôt.`,
    );
  }
  // Ses fichiers (fiche, discussions) sont effacés du disque avec la fiche.
  const storageNames = await clientStorageNames(id);
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
  await deleteStoredFiles(storageNames);
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
      // Accès à l'espace client (jamais l'empreinte du mot de passe).
      account: {
        select: {
          login: true,
          active: true,
          createdAt: true,
          lastLoginAt: true,
          passwordChangedAt: true,
        },
      },
    },
  });
  if (!client) return null;
  const [activity, discussions] = await Promise.all([
    db.activityLog.findMany({
      where: { entityType: "client", entityId: id },
      orderBy: { createdAt: "asc" },
      select: { action: true, createdAt: true, details: true, user: { select: { name: true } } },
    }),
    // Les discussions internes sur le client contiennent aussi des données le concernant.
    db.discussion.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "asc" },
      select: {
        title: true,
        createdAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            createdAt: true,
            body: true,
            fromClient: true,
            author: { select: { name: true } },
          },
        },
      },
    }),
  ]);
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
    account,
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
    portalAccess: account,
    activity: activity.map((entry) => ({
      date: entry.createdAt.toISOString(),
      action: entry.action,
      user: entry.user?.name ?? null,
      details: entry.details,
    })),
    discussions: discussions.map((discussion) => ({
      title: discussion.title,
      date: discussion.createdAt.toISOString(),
      messages: discussion.messages.map((message) => ({
        date: message.createdAt.toISOString(),
        author: message.fromClient
          ? `${client.displayName} (client)`
          : (message.author?.name ?? null),
        body: message.body,
      })),
    })),
  };
}

/** Clients proposés dans l'éditeur de devis : non archivés, les plus récents si la recherche est vide. */
export function searchClientsForPicker(query: string, take = 10) {
  const words = searchWords(query);
  return db.client.findMany({
    where: { archivedAt: null, AND: words.map((word) => ({ searchText: { contains: word } })) },
    orderBy: words.length ? { sortName: "asc" } : { updatedAt: "desc" },
    take,
    select: { id: true, displayName: true, city: true, language: true, siteTypeId: true },
  });
}

export type PickerClient = Awaited<ReturnType<typeof searchClientsForPicker>>[number];
