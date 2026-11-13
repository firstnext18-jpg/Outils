import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isoToDbDate } from "@/domain/dates";
import {
  emptyBalance,
  overdrawProblem,
  PARTNER_KIND_LABELS,
  partnerBalance,
  type PartnerBalance,
  type PartnerKind,
} from "@/domain/partners";
import { formatChf } from "@/lib/format";
import { storeFiles } from "@/modules/files/service";
import type { PartnerMovementData } from "@/modules/partners/schemas";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import { deleteStoredFiles } from "@/server/files";
import type { CurrentUser } from "@/server/session";

/**
 * Argent des associés (utilisateurs de l'outil) : apports en capital, prêts,
 * remboursements et retraits. Réservé aux admins (vérifié par les pages et
 * les actions).
 */

const listSelect = {
  id: true,
  kind: true,
  date: true,
  amountCents: true,
  description: true,
  partner: { select: { id: true, name: true } },
  _count: { select: { receipts: true } },
} satisfies Prisma.PartnerMovementSelect;

export type PartnerMovementRow = Prisma.PartnerMovementGetPayload<{ select: typeof listSelect }>;

export function listPartnerMovements() {
  return db.partnerMovement.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: listSelect,
  });
}

/** Solde de chaque associé qui a au moins un mouvement, et le total. */
export async function partnerSummaries() {
  const [rows, partners] = await Promise.all([
    db.partnerMovement.groupBy({ by: ["partnerId", "kind"], _sum: { amountCents: true } }),
    db.user.findMany({
      where: { partnerMovements: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true },
    }),
  ]);
  const movementsOf = (partnerId: string) =>
    rows
      .filter((r) => r.partnerId === partnerId)
      .map((r) => ({ kind: r.kind as PartnerKind, amountCents: r._sum.amountCents ?? 0 }));
  const summaries = partners.map((partner) => ({
    ...partner,
    balance: partnerBalance(movementsOf(partner.id)),
  }));
  const total = summaries.reduce<PartnerBalance>(
    (sum, { balance }) => ({
      capitalCents: sum.capitalCents + balance.capitalCents,
      loanCents: sum.loanCents + balance.loanCents,
      inCents: sum.inCents + balance.inCents,
      outCents: sum.outCents + balance.outCents,
    }),
    emptyBalance(),
  );
  return { partners: summaries, total };
}

export function getPartnerMovement(id: string) {
  return db.partnerMovement.findUnique({
    where: { id },
    include: {
      partner: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      receipts: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, size: true, createdAt: true },
      },
    },
  });
}

/** Associés proposés : les utilisateurs actifs (et celui déjà choisi, même désactivé). */
export function partnerOptions(currentId?: string) {
  return db.user.findMany({
    where: { OR: [{ active: true }, ...(currentId ? [{ id: currentId }] : [])] },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Mouvements entre associés et entreprise sur une période (tableau de bord). */
export async function partnerTotals(range: { from: string; to: string }) {
  const rows = await db.partnerMovement.groupBy({
    by: ["kind"],
    where: { date: { gte: isoToDbDate(range.from), lte: isoToDbDate(range.to) } },
    _sum: { amountCents: true },
  });
  const balance = partnerBalance(
    rows.map((r) => ({ kind: r.kind as PartnerKind, amountCents: r._sum.amountCents ?? 0 })),
  );
  return { inCents: balance.inCents, outCents: balance.outCents };
}

// ---------------------------------------------------------------------------
// Contrôles : on ne rend jamais à un associé plus qu'il n'a mis
// ---------------------------------------------------------------------------

async function balanceWithout(partnerId: string, excludeId?: string) {
  const movements = await db.partnerMovement.findMany({
    where: { partnerId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { kind: true, amountCents: true },
  });
  return partnerBalance(movements);
}

function negativeProblem(balance: PartnerBalance, name: string): string | null {
  if (balance.loanCents < 0) {
    return `${name} aurait alors été remboursé de plus que son prêt. Modifiez ou supprimez d'abord les remboursements concernés.`;
  }
  if (balance.capitalCents < 0) {
    return `${name} aurait alors retiré plus que son capital. Modifiez ou supprimez d'abord les retraits concernés.`;
  }
  return null;
}

async function partnerOrThrow(partnerId: string, allowInactiveId?: string) {
  const partner = await db.user.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true, active: true },
  });
  if (!partner || (!partner.active && partner.id !== allowInactiveId)) {
    throw new UserError("Choisissez un associé parmi les utilisateurs actifs.");
  }
  return partner;
}

/** Le mouvement (nouveau ou modifié) laisse-t-il des soldes cohérents ? */
async function checkBalances(
  data: PartnerMovementData,
  partnerName: string,
  existing?: { id: string; partnerId: string; partnerName: string },
) {
  const others = await balanceWithout(data.partnerId, existing?.id);
  const overdraw = overdrawProblem(data, others, formatChf);
  if (overdraw) throw new UserError(overdraw);
  const after = partnerBalance([
    { kind: "CAPITAL_IN", amountCents: others.capitalCents },
    { kind: "LOAN_IN", amountCents: others.loanCents },
    data,
  ]);
  const problem = negativeProblem(after, partnerName);
  if (problem) throw new UserError(problem);
  // Associé changé : l'ancien ne doit pas se retrouver remboursé de trop.
  if (existing && existing.partnerId !== data.partnerId) {
    const previous = negativeProblem(
      await balanceWithout(existing.partnerId, existing.id),
      existing.partnerName,
    );
    if (previous) throw new UserError(previous);
  }
}

function label(kind: PartnerKind, partnerName: string) {
  return `${PARTNER_KIND_LABELS[kind]} · ${partnerName}`;
}

function columns(data: PartnerMovementData) {
  return {
    partnerId: data.partnerId,
    kind: data.kind,
    date: isoToDbDate(data.date),
    amountCents: data.amountCents,
    description: data.description,
    notes: data.notes,
  };
}

export async function createPartnerMovement(
  actor: CurrentUser,
  data: PartnerMovementData,
  receipts: File[],
) {
  const partner = await partnerOrThrow(data.partnerId);
  await checkBalances(data, partner.name);
  const movement = await db.partnerMovement.create({
    data: { ...columns(data), createdById: actor.id },
  });
  if (receipts.length) {
    await storeFiles(receipts, {
      partnerMovementId: movement.id,
      visibleToClient: false,
      uploadedById: actor.id,
    }).catch(async (error: unknown) => {
      await db.partnerMovement.delete({ where: { id: movement.id } });
      throw error;
    });
  }
  await logActivity({
    userId: actor.id,
    action: "partner.created",
    entityType: "partner_movement",
    entityId: movement.id,
    label: label(data.kind, partner.name),
    details: { amount: formatChf(data.amountCents) },
  });
  return movement;
}

export async function updatePartnerMovement(
  actor: CurrentUser,
  id: string,
  data: PartnerMovementData,
) {
  const existing = await db.partnerMovement.findUnique({
    where: { id },
    select: { id: true, partnerId: true, partner: { select: { name: true } } },
  });
  if (!existing) throw new UserError("Ce mouvement n'existe plus.");
  const partner = await partnerOrThrow(data.partnerId, existing.partnerId);
  await checkBalances(data, partner.name, {
    id,
    partnerId: existing.partnerId,
    partnerName: existing.partner.name,
  });
  const movement = await db.partnerMovement.update({ where: { id }, data: columns(data) });
  await logActivity({
    userId: actor.id,
    action: "partner.updated",
    entityType: "partner_movement",
    entityId: id,
    label: label(data.kind, partner.name),
    details: { amount: formatChf(data.amountCents) },
  });
  return movement;
}

export async function addPartnerReceipts(actor: CurrentUser, id: string, receipts: File[]) {
  const movement = await db.partnerMovement.findUnique({ where: { id }, select: { id: true } });
  if (!movement) throw new UserError("Ce mouvement n'existe plus.");
  await storeFiles(receipts, {
    partnerMovementId: id,
    visibleToClient: false,
    uploadedById: actor.id,
  });
}

export async function deletePartnerMovement(actor: CurrentUser, id: string) {
  const movement = await db.partnerMovement.findUnique({
    where: { id },
    include: {
      partner: { select: { name: true } },
      receipts: { select: { storageName: true } },
    },
  });
  if (!movement) throw new UserError("Ce mouvement n'existe plus.");
  const problem = negativeProblem(
    await balanceWithout(movement.partnerId, id),
    movement.partner.name,
  );
  if (problem) throw new UserError(problem);
  await db.partnerMovement.delete({ where: { id } });
  await deleteStoredFiles(movement.receipts.map((r) => r.storageName));
  await logActivity({
    userId: actor.id,
    action: "partner.deleted",
    entityType: "partner_movement",
    entityId: id,
    label: label(movement.kind, movement.partner.name),
    details: { amount: formatChf(movement.amountCents) },
  });
}
