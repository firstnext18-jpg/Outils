import "server-only";
import { z } from "zod";
import { addDays, isValidIsoDate, zurichMidnight } from "@/domain/dates";
import { JOURNAL_CATEGORIES, journalHref, type JournalCategory } from "@/domain/journal";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export const JOURNAL_PAGE_SIZE = 50;

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value) || undefined;
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(first, schema.optional()).catch(undefined);

/** Filtres de l'adresse : `?utilisateur=…&type=devis&du=…&au=…&q=…&page=2`. */
export const journalParamsSchema = z.object({
  utilisateur: optional(z.uuid()),
  type: optional(z.enum(Object.keys(JOURNAL_CATEGORIES) as [JournalCategory])),
  du: optional(z.string().refine(isValidIsoDate)),
  au: optional(z.string().refine(isValidIsoDate)),
  q: optional(z.string().trim().max(100)),
  page: optional(z.coerce.number().int().min(1).max(10_000)),
});

export type JournalParams = z.output<typeof journalParamsSchema>;

function where(params: JournalParams): Prisma.ActivityLogWhereInput {
  const conditions: Prisma.ActivityLogWhereInput[] = [];
  if (params.utilisateur) conditions.push({ userId: params.utilisateur });
  if (params.type) {
    conditions.push({
      OR: JOURNAL_CATEGORIES[params.type].prefixes.map((prefix) => ({
        action: { startsWith: prefix },
      })),
    });
  }
  // Journées entières, à l'heure de Zurich.
  if (params.du) conditions.push({ createdAt: { gte: zurichMidnight(params.du) } });
  if (params.au) conditions.push({ createdAt: { lt: zurichMidnight(addDays(params.au, 1)) } });
  if (params.q) conditions.push({ label: { contains: params.q, mode: "insensitive" } });
  return { AND: conditions };
}

/** Une page du journal, du plus récent au plus ancien, avec les liens encore valables. */
export async function listJournal(params: JournalParams) {
  const filter = where(params);
  const total = await db.activityLog.count({ where: filter });
  const pageCount = Math.max(1, Math.ceil(total / JOURNAL_PAGE_SIZE));
  const page = Math.min(params.page ?? 1, pageCount);
  const entries = await db.activityLog.findMany({
    where: filter,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * JOURNAL_PAGE_SIZE,
    take: JOURNAL_PAGE_SIZE,
    include: { user: { select: { name: true } } },
  });

  // Les objets supprimés depuis n'ont plus de page : pas de lien.
  const ids = (type: string) =>
    entries.filter((e) => e.entityType === type && e.entityId).map((e) => e.entityId!);
  const [clients, quotes, invoices, subscriptions, discussions] = await Promise.all([
    db.client.findMany({ where: { id: { in: ids("client") } }, select: { id: true } }),
    db.quote.findMany({ where: { id: { in: ids("quote") } }, select: { id: true } }),
    db.invoice.findMany({ where: { id: { in: ids("invoice") } }, select: { id: true } }),
    db.subscription.findMany({ where: { id: { in: ids("subscription") } }, select: { id: true } }),
    db.discussion.findMany({ where: { id: { in: ids("discussion") } }, select: { id: true } }),
  ]);
  const existing = new Set(
    [...clients, ...quotes, ...invoices, ...subscriptions, ...discussions].map((r) => r.id),
  );

  return {
    total,
    page,
    pageCount,
    entries: entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      user: entry.user,
      action: entry.action,
      label: entry.label,
      details: entry.details,
      href:
        entry.entityId && existing.has(entry.entityId)
          ? journalHref(entry.entityType, entry.entityId)
          : null,
    })),
  };
}

export function journalUsers() {
  return db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
