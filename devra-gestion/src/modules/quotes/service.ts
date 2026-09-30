import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { addDays, isoToDbDate, todayIso, yearOf } from "@/domain/dates";
import {
  canTransition,
  isQuoteEditable,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from "@/domain/quote-status";
import { normalizeSearchText, searchWords } from "@/domain/search";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db, type Tx } from "@/server/db";
import { allocateDocumentNumber } from "@/server/numbering";
import type { CurrentUser } from "@/server/session";
import { companySnapshot } from "@/modules/settings/documents";
import { getSettings } from "@/modules/settings/service";
import { quoteColumns } from "@/modules/quotes/columns";
import { quoteToInput } from "@/modules/quotes/form";
import {
  QUOTE_STATUS_PARAMS,
  quoteInputSchema,
  type QuoteData,
  type QuoteListParams,
} from "@/modules/quotes/schemas";

export const QUOTES_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export function buildQuoteWhere(
  params: QuoteListParams,
  clientId?: string,
): Prisma.QuoteWhereInput {
  const where: Prisma.QuoteWhereInput[] = [];
  if (clientId) where.push({ clientId });
  if (params.statut) where.push({ status: QUOTE_STATUS_PARAMS[params.statut] });
  // Chaque mot doit se trouver dans le numéro / l'objet du devis ou dans la fiche du client.
  for (const word of searchWords(params.q ?? "")) {
    where.push({
      OR: [{ searchText: { contains: word } }, { client: { searchText: { contains: word } } }],
    });
  }
  return { AND: where };
}

const listSelect = {
  id: true,
  number: true,
  status: true,
  subject: true,
  issueDate: true,
  validUntil: true,
  totalCents: true,
  recurringMonthlyCents: true,
  recurringQuarterlyCents: true,
  recurringYearlyCents: true,
  client: { select: { id: true, displayName: true } },
} satisfies Prisma.QuoteSelect;

export type QuoteListRow = Prisma.QuoteGetPayload<{ select: typeof listSelect }>;

export async function listQuotes(params: QuoteListParams) {
  const where = buildQuoteWhere(params);
  const total = await db.quote.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / QUOTES_PAGE_SIZE));
  const page = Math.min(params.page ?? 1, pageCount);
  const quotes = await db.quote.findMany({
    where,
    orderBy: [{ issueDate: "desc" }, { year: "desc" }, { sequence: "desc" }],
    skip: (page - 1) * QUOTES_PAGE_SIZE,
    take: QUOTES_PAGE_SIZE,
    select: listSelect,
  });
  return { quotes, total, page, pageCount };
}

export function countAllQuotes() {
  return db.quote.count();
}

export function listClientQuotes(clientId: string) {
  return db.quote.findMany({
    where: { clientId },
    orderBy: [{ issueDate: "desc" }, { sequence: "desc" }],
    select: listSelect,
  });
}

export function getQuote(id: string) {
  return db.quote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { position: "asc" } },
      client: true,
      siteType: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });
}

export type QuoteDetail = NonNullable<Awaited<ReturnType<typeof getQuote>>>;

export function getQuoteActivity(id: string) {
  return db.activityLog.findMany({
    where: { entityType: "quote", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      action: true,
      details: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
}

export function searchQuotes(query: string, take = 6) {
  const words = searchWords(query);
  if (words.length === 0) return Promise.resolve([]);
  return db.quote.findMany({
    where: buildQuoteWhere({ q: query }),
    orderBy: [{ issueDate: "desc" }, { sequence: "desc" }],
    take,
    select: {
      id: true,
      number: true,
      status: true,
      subject: true,
      client: { select: { displayName: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

async function assertClient(tx: Tx, clientId: string) {
  const client = await tx.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new UserError("Ce client n'existe plus. Choisissez-en un autre.");
}

function quoteSearchText(number: string, subject: string) {
  return normalizeSearchText(`${number} ${subject}`);
}

async function log(
  tx: Tx | typeof db,
  actor: CurrentUser | null,
  action: Parameters<typeof logActivity>[0]["action"],
  quote: { id: string; number: string },
  details?: Prisma.InputJsonValue,
) {
  await logActivity(
    {
      userId: actor?.id ?? null,
      action,
      entityType: "quote",
      entityId: quote.id,
      label: quote.number,
      details,
    },
    tx,
  );
}

/** Création : le numéro (D-AAAA-NNN) est attribué dans la même transaction. */
export async function createQuote(
  actor: CurrentUser,
  data: QuoteData,
  source?: { duplicatedFrom: string },
) {
  const settings = await getSettings();
  const { columns, lines } = quoteColumns(data, settings.vatEnabled);
  return db.$transaction(async (tx) => {
    await assertClient(tx, data.clientId);
    const year = yearOf(data.issueDate);
    const { number, sequence } = await allocateDocumentNumber(
      tx,
      "QUOTE",
      year,
      settings.quoteNumberFormat,
    );
    const quote = await tx.quote.create({
      data: {
        ...columns,
        number,
        year,
        sequence,
        searchText: quoteSearchText(number, data.subject),
        createdById: actor.id,
        updatedById: actor.id,
        lines: { create: lines },
      },
    });
    await log(
      tx,
      actor,
      source ? "quote.duplicated" : "quote.created",
      quote,
      source ? { from: source.duplicatedFrom } : undefined,
    );
    return quote;
  });
}

/** Modification d'un brouillon, avec verrouillage optimiste ; les lignes sont remplacées. */
export async function updateQuote(
  actor: CurrentUser,
  id: string,
  version: number,
  data: QuoteData,
) {
  const existing = await db.quote.findUnique({ where: { id } });
  if (!existing) throw new UserError("Ce devis n'existe plus.");
  if (!isQuoteEditable(existing.status)) {
    throw new UserError(
      "Seul un brouillon peut être modifié. Repassez le devis en brouillon pour le corriger.",
    );
  }
  const settings = await getSettings();
  const { columns, lines } = quoteColumns(data, settings.vatEnabled);

  await db.$transaction(async (tx) => {
    await assertClient(tx, data.clientId);
    const result = await tx.quote.updateMany({
      where: { id, version, status: "DRAFT" },
      data: {
        ...columns,
        searchText: quoteSearchText(existing.number, data.subject),
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new UserError(
        "Ce devis a été modifié par quelqu'un d'autre entre-temps. Rechargez la page pour voir la dernière version, puis refaites vos changements.",
      );
    }
    await tx.quoteLine.deleteMany({ where: { quoteId: id } });
    await tx.quoteLine.createMany({ data: lines.map((line) => ({ ...line, quoteId: id })) });
    await log(tx, actor, "quote.updated", existing);
  });
}

/** Coordonnées du client figées sur le document. */
function clientSnapshot(client: {
  displayName: string;
  kind: string;
  contactName: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  country: string;
}) {
  return {
    displayName: client.displayName,
    kind: client.kind,
    contactName: client.contactName,
    street: client.street,
    streetNumber: client.streetNumber,
    postalCode: client.postalCode,
    city: client.city,
    country: client.country,
  };
}

export async function changeQuoteStatus(actor: CurrentUser, id: string, to: QuoteStatus) {
  const quote = await db.quote.findUnique({ where: { id }, include: { client: true } });
  if (!quote) throw new UserError("Ce devis n'existe plus.");
  if (!canTransition(quote.status, to)) {
    throw new UserError(
      `Impossible de passer de « ${QUOTE_STATUS_LABELS[quote.status]} » à « ${QUOTE_STATUS_LABELS[to]} ».`,
    );
  }
  const now = new Date();
  const data: Prisma.QuoteUncheckedUpdateManyInput = {
    status: to,
    updatedById: actor.id,
    version: { increment: 1 },
  };
  if (to === "SENT" && quote.status === "DRAFT") {
    // À l'envoi, les coordonnées sont figées : le PDF restera identique.
    data.sentAt = now;
    data.clientSnapshot = clientSnapshot(quote.client);
    data.companySnapshot = companySnapshot(await getSettings());
  } else if (to === "SENT") {
    data.decidedAt = null; // annulation d'une acceptation ou d'un refus
  }
  if (to === "ACCEPTED" || to === "REFUSED") data.decidedAt = now;
  if (to === "DRAFT") {
    data.sentAt = null;
    data.decidedAt = null;
    data.clientSnapshot = Prisma.DbNull;
    data.companySnapshot = Prisma.DbNull;
  }

  await db.$transaction(async (tx) => {
    // Condition sur le statut lu : si quelqu'un l'a changé entre-temps, rien n'est modifié.
    const result = await tx.quote.updateMany({ where: { id, status: quote.status }, data });
    if (result.count === 0)
      throw new UserError("Le statut de ce devis vient de changer. Rechargez la page.");
    await log(tx, actor, "quote.status_changed", quote, { from: quote.status, to });
  });
}

/** Duplication : nouveau brouillon, nouvelles dates, mêmes lignes et textes. */
export async function duplicateQuote(actor: CurrentUser, id: string) {
  const quote = await db.quote.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!quote) throw new UserError("Ce devis n'existe plus.");
  const settings = await getSettings();
  const issueDate = todayIso();
  const input = {
    ...quoteToInput(quote),
    issueDate,
    validUntil: addDays(issueDate, settings.quoteValidityDays),
  };
  const data = quoteInputSchema.parse(input);
  return createQuote(actor, data, { duplicatedFrom: quote.number });
}

export async function deleteQuote(actor: CurrentUser, id: string) {
  const quote = await db.quote.findUnique({ where: { id } });
  if (!quote) throw new UserError("Ce devis n'existe plus.");
  if (quote.status !== "DRAFT") {
    throw new UserError(
      "Seul un brouillon peut être supprimé. Un devis envoyé reste dans l'historique.",
    );
  }
  await db.$transaction(async (tx) => {
    await tx.quote.delete({ where: { id } });
    await log(tx, actor, "quote.deleted", quote);
  });
}

/**
 * Passe en « expiré » les devis envoyés dont la validité est dépassée.
 * Appelé à l'affichage des devis (et, dès la phase 7, chaque matin par le cron).
 */
export async function expireQuotes(today = todayIso()) {
  const expired = await db.quote.findMany({
    where: { status: "SENT", validUntil: { lt: isoToDbDate(today) } },
    select: { id: true, number: true },
  });
  for (const quote of expired) {
    await db.$transaction(async (tx) => {
      const result = await tx.quote.updateMany({
        where: { id: quote.id, status: "SENT" },
        data: { status: "EXPIRED", version: { increment: 1 } },
      });
      if (result.count > 0)
        await log(tx, null, "quote.status_changed", quote, { from: "SENT", to: "EXPIRED" });
    });
  }
  return expired.length;
}
