import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { catalogSearchText } from "@/domain/catalog";
import { searchWords } from "@/domain/search";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";
import {
  LINE_TYPE_PARAMS,
  type CatalogItemData,
  type CatalogListParams,
} from "@/modules/catalog/schemas";

function withSearchText(data: CatalogItemData) {
  return { ...data, searchText: catalogSearchText(data) };
}

export function buildCatalogWhere(params: CatalogListParams): Prisma.CatalogItemWhereInput {
  const where: Prisma.CatalogItemWhereInput[] = [];
  const status = params.statut ?? "actives";
  if (status === "actives") where.push({ active: true });
  if (status === "inactives") where.push({ active: false });
  if (params.type) where.push({ lineType: LINE_TYPE_PARAMS[params.type] });
  if (params.categorie) where.push({ category: params.categorie });
  for (const word of searchWords(params.q ?? "")) where.push({ searchText: { contains: word } });
  return { AND: where };
}

/** Prestations triées par catégorie puis par nom (le catalogue reste de taille modeste). */
export function listCatalogItems(params: CatalogListParams) {
  return db.catalogItem.findMany({
    where: buildCatalogWhere(params),
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export type CatalogItemRow = Awaited<ReturnType<typeof listCatalogItems>>[number];

export async function listCatalogCategories(): Promise<string[]> {
  const rows = await db.catalogItem.findMany({
    where: { category: { not: "" } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((row) => row.category);
}

export function countCatalogItems() {
  return db.catalogItem.count();
}

async function log(
  actor: CurrentUser,
  action: Parameters<typeof logActivity>[0]["action"],
  item: { id: string; name: string },
) {
  await logActivity({
    userId: actor.id,
    action,
    entityType: "catalog_item",
    entityId: item.id,
    label: item.name,
  });
}

export async function createCatalogItem(actor: CurrentUser, data: CatalogItemData) {
  const item = await db.catalogItem.create({
    data: { ...withSearchText(data), createdById: actor.id, updatedById: actor.id },
  });
  await log(actor, "catalog.created", item);
  return item;
}

/** Modification avec verrouillage optimiste (voir les clients). */
export async function updateCatalogItem(
  actor: CurrentUser,
  id: string,
  version: number,
  data: CatalogItemData,
) {
  const result = await db.catalogItem.updateMany({
    where: { id, version },
    data: { ...withSearchText(data), updatedById: actor.id, version: { increment: 1 } },
  });
  if (result.count === 0) {
    const exists = await db.catalogItem.count({ where: { id } });
    throw new UserError(
      exists
        ? "Cette prestation a été modifiée par quelqu'un d'autre entre-temps. Fermez la fenêtre, rechargez la page et refaites vos changements."
        : "Cette prestation n'existe plus.",
    );
  }
  await log(actor, "catalog.updated", { id, name: data.name });
}

export async function setCatalogItemActive(actor: CurrentUser, id: string, active: boolean) {
  const item = await db.catalogItem.findUnique({ where: { id } });
  if (!item) throw new UserError("Cette prestation n'existe plus.");
  if (item.active === active) return;
  await db.catalogItem.update({
    where: { id },
    data: { active, updatedById: actor.id, version: { increment: 1 } },
  });
  await log(actor, active ? "catalog.activated" : "catalog.deactivated", item);
}

/**
 * Suppression définitive. Les devis et factures gardent une copie de chaque
 * ligne : supprimer une prestation ne modifie aucun document existant.
 */
export async function deleteCatalogItem(actor: CurrentUser, id: string) {
  const item = await db.catalogItem.findUnique({ where: { id } });
  if (!item) throw new UserError("Cette prestation n'existe plus.");
  await db.catalogItem.delete({ where: { id } });
  await log(actor, "catalog.deleted", item);
}
