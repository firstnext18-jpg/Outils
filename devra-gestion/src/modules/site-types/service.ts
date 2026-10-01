import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export function listSiteTypesWithUsage() {
  return db.siteType.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, _count: { select: { clients: true } } },
  });
}

function log(actor: CurrentUser, operation: string, name: string) {
  return logActivity({
    userId: actor.id,
    action: "settings.site_types_updated",
    entityType: "settings",
    label: name,
    details: { operation },
  });
}

/** Nom déjà pris (comparaison sans tenir compte de la casse). */
async function assertNameAvailable(name: string, exceptId?: string) {
  const existing = await db.siteType.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      id: exceptId ? { not: exceptId } : undefined,
    },
  });
  if (existing) throw new UserError(`Le type « ${existing.name} » existe déjà.`);
}

export async function createSiteType(actor: CurrentUser, name: string) {
  await assertNameAvailable(name);
  const last = await db.siteType.aggregate({ _max: { position: true } });
  try {
    await db.siteType.create({ data: { name, position: (last._max.position ?? -1) + 1 } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserError(`Le type « ${name} » existe déjà.`);
    }
    throw error;
  }
  await log(actor, "created", name);
}

export async function renameSiteType(actor: CurrentUser, id: string, name: string) {
  const siteType = await db.siteType.findUnique({ where: { id } });
  if (!siteType) throw new UserError("Ce type de site n'existe plus.");
  await assertNameAvailable(name, id);
  await db.siteType.update({ where: { id }, data: { name } });
  await log(actor, "renamed", `${siteType.name} → ${name}`);
}

export async function setSiteTypeActive(actor: CurrentUser, id: string, active: boolean) {
  const siteType = await db.siteType.update({ where: { id }, data: { active } });
  await log(actor, active ? "activated" : "deactivated", siteType.name);
}

/** Échange la position avec le type voisin (monter / descendre dans la liste). */
export async function moveSiteType(actor: CurrentUser, id: string, direction: "up" | "down") {
  const all = await db.siteType.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
  const index = all.findIndex((t) => t.id === id);
  const neighbor = all[direction === "up" ? index - 1 : index + 1];
  const current = all[index];
  if (!current || !neighbor) return;
  // Renumérote toute la liste pour garantir des positions distinctes.
  const reordered = [...all];
  reordered[index] = neighbor;
  reordered[all.indexOf(neighbor)] = current;
  await db.$transaction(
    reordered.map((t, position) => db.siteType.update({ where: { id: t.id }, data: { position } })),
  );
  await log(actor, "moved", current.name);
}

/** Suppression possible seulement si aucun client n'utilise ce type. */
export async function deleteSiteType(actor: CurrentUser, id: string) {
  const siteType = await db.siteType.findUnique({
    where: { id },
    include: { _count: { select: { clients: true } } },
  });
  if (!siteType) throw new UserError("Ce type de site n'existe plus.");
  if (siteType._count.clients > 0) {
    throw new UserError(
      `« ${siteType.name} » est utilisé par ${siteType._count.clients} client(s) : désactivez-le plutôt.`,
    );
  }
  await db.siteType.delete({ where: { id } });
  await log(actor, "deleted", siteType.name);
}
