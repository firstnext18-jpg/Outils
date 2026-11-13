import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, isoToDbDate, todayIso } from "@/domain/dates";
import { elapsedMinutes } from "@/domain/time";
import { createTimeInvoice } from "@/modules/invoices/service";
import type { TimeEntryData, TimeListParams } from "@/modules/time/schemas";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

/**
 * Suivi du temps : saisies manuelles et chronomètre (un seul en cours par
 * personne). Le temps facturable non facturé d'un client se transforme en
 * brouillon de facture en un clic.
 */

const entrySelect = {
  id: true,
  date: true,
  minutes: true,
  startedAt: true,
  description: true,
  billable: true,
  invoice: { select: { id: true, number: true } },
  client: { select: { id: true, displayName: true } },
  project: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.TimeEntrySelect;

export type TimeEntryRow = Prisma.TimeEntryGetPayload<{ select: typeof entrySelect }>;

/** Saisies de la période (par défaut : les 30 derniers jours), chronomètres en cours exclus. */
export async function listTimeEntries(params: TimeListParams) {
  const to = params.au ?? todayIso();
  const from = params.du ?? addDays(to, -30);
  const where: Prisma.TimeEntryWhereInput = {
    startedAt: null,
    date: { gte: isoToDbDate(from), lte: isoToDbDate(to) },
    ...(params.client ? { clientId: params.client } : {}),
    ...(params.projet ? { projectId: params.projet } : {}),
    ...(params.utilisateur ? { userId: params.utilisateur } : {}),
    ...(params.facture === "oui" ? { invoiceId: { not: null } } : {}),
    ...(params.facture === "non" ? { invoiceId: null } : {}),
  };
  const entries = await db.timeEntry.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: entrySelect,
  });
  const total = entries.reduce((sum, e) => sum + e.minutes, 0);
  const billable = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.minutes, 0);
  return { entries, from, to, total, billable };
}

/** Temps d'un projet (page du projet). */
export function projectTimeEntries(projectId: string) {
  return db.timeEntry.findMany({
    where: { projectId, startedAt: null },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: entrySelect,
  });
}

/** Clients qui ont du temps facturable pas encore facturé. */
export async function unbilledByClient() {
  const rows = await db.timeEntry.groupBy({
    by: ["clientId"],
    where: { billable: true, invoiceId: null, startedAt: null, minutes: { gt: 0 } },
    _sum: { minutes: true },
    _count: true,
  });
  if (rows.length === 0) return [];
  const clients = await db.client.findMany({
    where: { id: { in: rows.map((r) => r.clientId) } },
    select: { id: true, displayName: true },
  });
  return rows
    .map((row) => ({
      client: clients.find((c) => c.id === row.clientId)!,
      minutes: row._sum.minutes ?? 0,
      entries: row._count,
    }))
    .filter((row) => row.client)
    .sort((a, b) => a.client.displayName.localeCompare(b.client.displayName, "fr"));
}

async function assertTarget(data: { clientId: string; projectId: string | null }) {
  const client = await db.client.findUnique({ where: { id: data.clientId }, select: { id: true } });
  if (!client) throw new UserError("Ce client n'existe plus.");
  if (data.projectId) {
    const project = await db.project.findFirst({
      where: { id: data.projectId, clientId: data.clientId },
      select: { id: true },
    });
    if (!project) throw new UserError("Ce projet n'appartient pas à ce client.");
  }
}

export async function createTimeEntry(actor: CurrentUser, data: TimeEntryData) {
  await assertTarget(data);
  return db.timeEntry.create({
    data: { ...data, date: isoToDbDate(data.date), userId: actor.id },
  });
}

async function editableEntry(id: string) {
  const entry = await db.timeEntry.findUnique({ where: { id } });
  if (!entry) throw new UserError("Cette saisie n'existe plus.");
  if (entry.invoiceId) {
    throw new UserError("Ce temps a été facturé : supprimez d'abord le brouillon de facture.");
  }
  return entry;
}

export async function updateTimeEntry(actor: CurrentUser, id: string, data: TimeEntryData) {
  await editableEntry(id);
  await assertTarget(data);
  return db.timeEntry.update({
    where: { id },
    data: { ...data, date: isoToDbDate(data.date) },
  });
}

export async function deleteTimeEntry(actor: CurrentUser, id: string) {
  const entry = await editableEntry(id);
  await db.timeEntry.delete({ where: { id } });
  return entry;
}

// ---------------------------------------------------------------------------
// Chronomètre
// ---------------------------------------------------------------------------

export function runningTimer(userId: string) {
  return db.timeEntry.findFirst({
    where: { userId, startedAt: { not: null } },
    select: entrySelect,
  });
}

/** Démarre le chronomètre (celui déjà en cours est d'abord arrêté et enregistré). */
export async function startTimer(
  actor: CurrentUser,
  input: { clientId: string; projectId: string | null; description: string },
) {
  await assertTarget(input);
  await stopTimer(actor);
  const now = new Date();
  return db.timeEntry.create({
    data: {
      ...input,
      userId: actor.id,
      date: isoToDbDate(todayIso(now)),
      startedAt: now,
      minutes: 0,
    },
  });
}

/** Arrête le chronomètre : la durée écoulée devient une saisie. */
export async function stopTimer(actor: CurrentUser) {
  const running = await db.timeEntry.findFirst({
    where: { userId: actor.id, startedAt: { not: null } },
  });
  if (!running?.startedAt) return null;
  return db.timeEntry.update({
    where: { id: running.id },
    data: { startedAt: null, minutes: elapsedMinutes(running.startedAt) },
  });
}

// ---------------------------------------------------------------------------
// Facturation
// ---------------------------------------------------------------------------

/** Brouillon de facture avec tout le temps facturable non facturé du client. */
export function billClientTime(actor: CurrentUser, clientId: string) {
  return createTimeInvoice(actor, clientId);
}
