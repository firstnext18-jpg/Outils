import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { LIST_LABELS, type ListKind } from "@/domain/lists";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

const order = [{ position: "asc" as const }, { name: "asc" as const }];

/** Valeurs d'une liste et le nombre d'éléments qui les utilisent. */
export async function listItemsWithUsage(kind: ListKind) {
  const items = await db.listItem.findMany({
    where: { kind },
    orderBy: order,
    select: {
      id: true,
      name: true,
      active: true,
      _count: { select: { clients: true, expenses: true } },
    },
  });
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    active: item.active,
    usage: item._count.clients + item._count.expenses,
  }));
}

/** Valeurs proposées dans les formulaires (actives, plus la valeur actuelle si elle a été désactivée). */
export function listOptions(kind: ListKind, currentId?: string | null) {
  return db.listItem.findMany({
    where: { kind, OR: [{ active: true }, ...(currentId ? [{ id: currentId }] : [])] },
    orderBy: order,
    select: { id: true, name: true, active: true },
  });
}

function log(actor: CurrentUser, kind: ListKind, operation: string, name: string) {
  return logActivity({
    userId: actor.id,
    action: "settings.lists_updated",
    entityType: "settings",
    label: name,
    details: { operation, list: LIST_LABELS[kind].title },
  });
}

async function itemOrThrow(id: string) {
  const item = await db.listItem.findUnique({
    where: { id },
    include: { _count: { select: { clients: true, expenses: true } } },
  });
  if (!item) throw new UserError("Cette valeur n'existe plus. Rechargez la page.");
  return item;
}

async function assertNameAvailable(kind: ListKind, name: string, exceptId?: string) {
  const existing = await db.listItem.findFirst({
    where: {
      kind,
      name: { equals: name, mode: "insensitive" },
      id: exceptId ? { not: exceptId } : undefined,
    },
  });
  if (existing) throw new UserError(`« ${existing.name} » existe déjà.`);
}

export async function createListItem(actor: CurrentUser, kind: ListKind, name: string) {
  await assertNameAvailable(kind, name);
  const last = await db.listItem.aggregate({ where: { kind }, _max: { position: true } });
  try {
    await db.listItem.create({ data: { kind, name, position: (last._max.position ?? -1) + 1 } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserError(`« ${name} » existe déjà.`);
    }
    throw error;
  }
  await log(actor, kind, "created", name);
}

export async function renameListItem(actor: CurrentUser, id: string, name: string) {
  const item = await itemOrThrow(id);
  await assertNameAvailable(item.kind, name, id);
  await db.listItem.update({ where: { id }, data: { name } });
  await log(actor, item.kind, "renamed", `${item.name} → ${name}`);
}

export async function setListItemActive(actor: CurrentUser, id: string, active: boolean) {
  const item = await itemOrThrow(id);
  await db.listItem.update({ where: { id }, data: { active } });
  await log(actor, item.kind, active ? "activated" : "deactivated", item.name);
}

export async function moveListItem(actor: CurrentUser, id: string, direction: "up" | "down") {
  const item = await itemOrThrow(id);
  const all = await db.listItem.findMany({ where: { kind: item.kind }, orderBy: order });
  const index = all.findIndex((i) => i.id === id);
  const neighbor = all[direction === "up" ? index - 1 : index + 1];
  if (!neighbor) return;
  const reordered = [...all];
  reordered[index] = neighbor;
  reordered[all.indexOf(neighbor)] = item;
  await db.$transaction(
    reordered.map((i, position) => db.listItem.update({ where: { id: i.id }, data: { position } })),
  );
  await log(actor, item.kind, "moved", item.name);
}

/** Suppression possible seulement si la valeur n'est utilisée nulle part. */
export async function deleteListItem(actor: CurrentUser, id: string) {
  const item = await itemOrThrow(id);
  const usage = item._count.clients + item._count.expenses;
  if (usage > 0) {
    throw new UserError(`« ${item.name} » est utilisé ${usage} fois : désactivez-le plutôt.`);
  }
  await db.listItem.delete({ where: { id } });
  await log(actor, item.kind, "deleted", item.name);
}
