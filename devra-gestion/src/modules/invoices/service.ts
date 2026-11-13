import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { addDays, dbDateToIso, formatIsoDate, isoToDbDate, todayIso, yearOf } from "@/domain/dates";
import {
  balanceCents,
  canCancel,
  INVOICE_STATUS_LABELS,
  isOpen,
  outstandingCents,
  owedCents,
  PAYMENT_METHOD_LABELS,
  statusAfterPayments,
} from "@/domain/invoice-status";
import { defaultDueDate, depositParts, type Deduction } from "@/domain/invoices";
import { formatPercent } from "@/domain/percent";
import { missingQrRequirements, paymentSetup } from "@/domain/qr-bill";
import { normalizeSearchText, searchWords } from "@/domain/search";
import { formatDuration, hoursQuantity } from "@/domain/time";
import { documentLabels, fillLabel } from "@/i18n/documents";
import { formatAmount, formatChf } from "@/lib/format";
import {
  discountToInput,
  storedDocumentTotals,
  storedLineToInput,
} from "@/modules/documents/lines";
import { invoiceColumns } from "@/modules/invoices/columns";
import { invoiceToInput } from "@/modules/invoices/form";
import {
  INVOICE_STATUS_PARAMS,
  invoiceInputSchema,
  type InvoiceData,
  type InvoiceInput,
  type InvoiceListParams,
  type PaymentData,
} from "@/modules/invoices/schemas";
import { clientSnapshot, companySnapshot } from "@/modules/settings/documents";
import { getSettings, type AppSettings } from "@/modules/settings/service";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db, type Tx } from "@/server/db";
import { allocateDocumentNumber } from "@/server/numbering";
import type { CurrentUser } from "@/server/session";

export const INVOICES_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export function buildInvoiceWhere(
  params: InvoiceListParams,
  clientId?: string,
  today = todayIso(),
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput[] = [];
  if (clientId) where.push({ clientId });
  const todayDb = isoToDbDate(today);
  const status = params.statut ? INVOICE_STATUS_PARAMS[params.statut] : undefined;
  switch (status) {
    case "DRAFT":
    case "PAID":
    case "CANCELLED":
      where.push({ status });
      break;
    // « Envoyée » et « partiellement payée » : seulement celles qui ne sont pas en retard.
    case "SENT":
      where.push({ status: "SENT", dueDate: { gte: todayDb } });
      break;
    case "PARTIALLY_PAID":
      where.push({ status: "PARTIALLY_PAID", dueDate: { gte: todayDb } });
      break;
    case "OVERDUE":
      where.push({ status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: todayDb } });
      break;
  }
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
  type: true,
  status: true,
  subject: true,
  issueDate: true,
  dueDate: true,
  amountDueCents: true,
  feesCents: true,
  paidCents: true,
  client: { select: { id: true, displayName: true } },
} satisfies Prisma.InvoiceSelect;

export type InvoiceListRow = Prisma.InvoiceGetPayload<{ select: typeof listSelect }>;

const listOrder: Prisma.InvoiceOrderByWithRelationInput[] = [
  { issueDate: "desc" },
  { year: { sort: "desc", nulls: "first" } },
  { sequence: { sort: "desc", nulls: "first" } },
  { createdAt: "desc" },
];

export async function listInvoices(params: InvoiceListParams) {
  const where = buildInvoiceWhere(params);
  const total = await db.invoice.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / INVOICES_PAGE_SIZE));
  const page = Math.min(params.page ?? 1, pageCount);
  const invoices = await db.invoice.findMany({
    where,
    orderBy: listOrder,
    skip: (page - 1) * INVOICES_PAGE_SIZE,
    take: INVOICES_PAGE_SIZE,
    select: listSelect,
  });
  return { invoices, total, page, pageCount };
}

export function countAllInvoices() {
  return db.invoice.count();
}

export function listClientInvoices(clientId: string) {
  return db.invoice.findMany({ where: { clientId }, orderBy: listOrder, select: listSelect });
}

export function listQuoteInvoices(quoteId: string) {
  return db.invoice.findMany({
    where: { quoteId },
    orderBy: { createdAt: "asc" },
    select: listSelect,
  });
}

/** Montants facturés, encaissés et impayés d'un client (factures émises, hors annulées). */
export async function clientInvoiceSummary(clientId: string) {
  const [issued, open] = await Promise.all([
    db.invoice.aggregate({
      where: { clientId, status: { in: ["SENT", "PARTIALLY_PAID", "PAID"] } },
      _sum: { amountDueCents: true, feesCents: true, paidCents: true },
    }),
    db.invoice.aggregate({
      where: { clientId, status: { in: ["SENT", "PARTIALLY_PAID"] } },
      _sum: { amountDueCents: true, feesCents: true, paidCents: true },
    }),
  ]);
  return {
    invoicedCents: (issued._sum.amountDueCents ?? 0) + (issued._sum.feesCents ?? 0),
    paidCents: issued._sum.paidCents ?? 0,
    unpaidCents:
      (open._sum.amountDueCents ?? 0) + (open._sum.feesCents ?? 0) - (open._sum.paidCents ?? 0),
  };
}

export function getInvoice(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { position: "asc" } },
      payments: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        include: { createdBy: { select: { name: true } } },
      },
      client: true,
      quote: { select: { id: true, number: true } },
      subscription: { select: { id: true, label: true } },
      siteType: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      reminders: {
        orderBy: { level: "asc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

export function getInvoiceActivity(id: string) {
  return db.activityLog.findMany({
    where: { entityType: "invoice", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      details: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
}

export function searchInvoices(query: string, take = 6) {
  if (searchWords(query).length === 0) return Promise.resolve([]);
  return db.invoice.findMany({
    where: buildInvoiceWhere({ q: query }),
    orderBy: listOrder,
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

/** Acomptes à déduire : factures d'acompte émises (non annulées) du devis. */
export function depositDeductions(
  invoices: {
    id: string;
    type: string;
    status: string;
    number: string | null;
    amountDueCents: number;
  }[],
): Deduction[] {
  return invoices
    .filter(
      (i) => i.type === "DEPOSIT" && i.number && i.status !== "DRAFT" && i.status !== "CANCELLED",
    )
    .map((i) => ({ invoiceId: i.id, number: i.number!, amountCents: i.amountDueCents }));
}

// ---------------------------------------------------------------------------
// Écriture : brouillons
// ---------------------------------------------------------------------------

async function assertClient(tx: Tx, clientId: string) {
  const client = await tx.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new UserError("Ce client n'existe plus. Choisissez-en un autre.");
}

function invoiceSearchText(number: string | null, subject: string) {
  return normalizeSearchText(`${number ?? ""} ${subject}`);
}

/** Libellé d'une facture dans le journal : son numéro, ou « brouillon ». */
function invoiceLabel(invoice: { number: string | null }) {
  return invoice.number ?? "Brouillon de facture";
}

async function log(
  tx: Tx | typeof db,
  actor: CurrentUser | null,
  action: Parameters<typeof logActivity>[0]["action"],
  invoice: { id: string; number: string | null },
  details?: Prisma.InputJsonValue,
) {
  await logActivity(
    {
      userId: actor?.id ?? null,
      action,
      entityType: "invoice",
      entityId: invoice.id,
      label: invoiceLabel(invoice),
      details,
    },
    tx,
  );
}

/** Les acomptes d'une facture finale, relus dans la base au moment de l'enregistrement. */
async function deductionsFor(tx: Tx, invoice: { type: string; quoteId: string | null }) {
  if (invoice.type !== "FINAL" || !invoice.quoteId) return [];
  const deposits = await tx.invoice.findMany({
    where: { quoteId: invoice.quoteId, type: "DEPOSIT" },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, status: true, number: true, amountDueCents: true },
  });
  if (deposits.some((d) => d.status === "DRAFT")) {
    throw new UserError(
      "La facture d'acompte de ce devis est encore un brouillon : émettez-la ou supprimez-la d'abord.",
    );
  }
  return depositDeductions(deposits);
}

type CreateOptions = {
  type?: "STANDARD" | "DEPOSIT" | "FINAL" | "SUBSCRIPTION";
  quoteId?: string | null;
  subscription?: { id: string; periodStart: string; periodEnd: string };
  source?: { action: "invoice.created" | "invoice.duplicated"; details?: Prisma.InputJsonValue };
};

async function createDraft(
  tx: Tx,
  actor: CurrentUser | null,
  data: InvoiceData,
  options: CreateOptions,
) {
  const settings = await getSettings(tx);
  await assertClient(tx, data.clientId);
  const type = options.type ?? "STANDARD";
  const deductions = await deductionsFor(tx, { type, quoteId: options.quoteId ?? null });
  const { columns, lines } = invoiceColumns(data, settings.vatEnabled, deductions);
  const invoice = await tx.invoice.create({
    data: {
      ...columns,
      type,
      quoteId: options.quoteId ?? null,
      subscriptionId: options.subscription?.id ?? null,
      periodStart: options.subscription ? isoToDbDate(options.subscription.periodStart) : null,
      periodEnd: options.subscription ? isoToDbDate(options.subscription.periodEnd) : null,
      searchText: invoiceSearchText(null, data.subject),
      createdById: actor?.id ?? null,
      updatedById: actor?.id ?? null,
      lines: { create: lines },
    },
  });
  const source = options.source ?? { action: "invoice.created" as const };
  await log(tx, actor, source.action, invoice, source.details);
  return invoice;
}

/** Nouvelle facture (brouillon, sans numéro). */
export function createInvoice(actor: CurrentUser, data: InvoiceData) {
  return db.$transaction((tx) => createDraft(tx, actor, data, {}));
}

/** Modification d'un brouillon, avec verrouillage optimiste ; les lignes sont remplacées. */
export async function updateInvoice(
  actor: CurrentUser,
  id: string,
  version: number,
  data: InvoiceData,
) {
  await db.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({ where: { id } });
    if (!existing) throw new UserError("Cette facture n'existe plus.");
    if (existing.status !== "DRAFT") {
      throw new UserError(
        "Une facture émise ne peut plus être modifiée : annulez-la et créez-en une nouvelle.",
      );
    }
    await assertClient(tx, data.clientId);
    const settings = await getSettings(tx);
    const deductions = await deductionsFor(tx, existing);
    const { columns, lines } = invoiceColumns(data, settings.vatEnabled, deductions);
    const result = await tx.invoice.updateMany({
      where: { id, version, status: "DRAFT" },
      data: {
        ...columns,
        deductions: columns.deductions ?? Prisma.DbNull,
        searchText: invoiceSearchText(null, data.subject),
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new UserError(
        "Cette facture a été modifiée par quelqu'un d'autre entre-temps. Rechargez la page pour voir la dernière version, puis refaites vos changements.",
      );
    }
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await tx.invoiceLine.createMany({ data: lines.map((line) => ({ ...line, invoiceId: id })) });
    await log(tx, actor, "invoice.updated", existing);
  });
}

export async function deleteInvoice(actor: CurrentUser, id: string) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw new UserError("Cette facture n'existe plus.");
  if (invoice.status !== "DRAFT") {
    throw new UserError(
      "Seul un brouillon peut être supprimé. Une facture émise s'annule (elle garde son numéro).",
    );
  }
  await db.$transaction(async (tx) => {
    await tx.invoice.delete({ where: { id } });
    await log(tx, actor, "invoice.deleted", invoice);
  });
}

/**
 * Duplication en nouveau brouillon (dates du jour). Une facture annulée est
 * remplacée par sa copie : celle-ci garde alors son type et son devis
 * d'origine (ex. facture d'acompte corrigée) ; sinon la copie est une facture simple.
 */
export async function duplicateInvoice(actor: CurrentUser, id: string) {
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) throw new UserError("Cette facture n'existe plus.");
  const settings = await getSettings();
  const issueDate = todayIso();
  const data = invoiceInputSchema.parse({
    ...invoiceToInput(invoice),
    issueDate,
    dueDate: defaultDueDate(issueDate, settings.paymentTermDays),
  });
  const replacement = invoice.status === "CANCELLED" && invoice.type !== "SUBSCRIPTION";
  return db.$transaction(async (tx) => {
    if (replacement && invoice.quoteId)
      await assertNoActiveInvoice(tx, invoice.quoteId, invoice.type);
    return createDraft(tx, actor, data, {
      type: replacement ? (invoice.type as "STANDARD" | "DEPOSIT" | "FINAL") : "STANDARD",
      quoteId: replacement ? invoice.quoteId : null,
      source: { action: "invoice.duplicated", details: { from: invoiceLabel(invoice) } },
    });
  });
}

// ---------------------------------------------------------------------------
// Conversion d'un devis accepté
// ---------------------------------------------------------------------------

type ConversionKind = "STANDARD" | "DEPOSIT" | "FINAL";

/** Une seule facture active (non annulée) de chaque sorte par devis. */
async function assertNoActiveInvoice(tx: Tx, quoteId: string, kind: string) {
  const kinds = kind === "DEPOSIT" ? ["DEPOSIT"] : ["STANDARD", "FINAL"];
  const existing = await tx.invoice.findFirst({
    where: {
      quoteId,
      type: { in: kinds as ("DEPOSIT" | "STANDARD" | "FINAL")[] },
      status: { not: "CANCELLED" },
    },
    select: { number: true },
  });
  if (existing) {
    throw new UserError(
      `Ce devis a déjà été facturé (${existing.number ?? "brouillon en cours"}). Annulez d'abord cette facture pour en créer une nouvelle.`,
    );
  }
}

function texts(settings: AppSettings, language: "FR" | "DE") {
  return language === "DE"
    ? { introText: settings.invoiceIntroDe, conditionsText: settings.invoiceConditionsDe }
    : { introText: settings.invoiceIntroFr, conditionsText: settings.invoiceConditionsFr };
}

// ---------------------------------------------------------------------------
// Facture du temps passé (suivi du temps)
// ---------------------------------------------------------------------------

/**
 * Brouillon de facture avec le temps facturable non facturé d'un client : une
 * ligne « à l'heure » par projet (tarif du projet, sinon celui des paramètres),
 * avec le détail des saisies. Le temps facturé ne sera plus proposé ; supprimer
 * le brouillon le libère.
 */
export async function createTimeInvoice(actor: CurrentUser, clientId: string) {
  return db.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { id: true, displayName: true, language: true, siteTypeId: true },
    });
    if (!client) throw new UserError("Ce client n'existe plus.");
    const entries = await tx.timeEntry.findMany({
      where: { clientId, billable: true, invoiceId: null, startedAt: null, minutes: { gt: 0 } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: { project: { select: { id: true, name: true, hourlyRateCents: true } } },
    });
    if (entries.length === 0) throw new UserError("Aucun temps à facturer pour ce client.");
    const settings = await getSettings(tx);
    const labels = documentLabels(client.language);
    const vatRateBps = settings.vatEnabled ? (settings.vatRates[0] ?? null) : null;

    const groups = new Map<string, typeof entries>();
    for (const entry of entries) {
      const key = entry.projectId ?? "";
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    const lines = [...groups.values()].map((group) => {
      const project = group[0]!.project;
      const rate = project?.hourlyRateCents ?? settings.hourlyRateCents;
      if (!rate) {
        throw new UserError(
          "Indiquez d'abord votre tarif horaire : Paramètres → Projets et sites (ou sur le projet).",
        );
      }
      const minutes = group.reduce((sum, e) => sum + e.minutes, 0);
      const detail = group
        .slice(0, 40)
        .map((e) =>
          [formatIsoDate(dbDateToIso(e.date)), e.description, formatDuration(e.minutes)]
            .filter(Boolean)
            .join(" · "),
        )
        .join("\n");
      return {
        catalogItemId: null,
        lineType: "HOURLY" as const,
        periodicity: null,
        label: project?.name ?? labels.timeOutsideProject,
        description: (group.length > 40 ? `${detail}\n…` : detail).slice(0, 2000),
        quantity: hoursQuantity(minutes),
        unit: "HOUR" as const,
        unitPrice: formatAmount(rate),
        discountType: "PERCENT" as const,
        discountValue: "",
        vatRateBps,
      };
    });

    const today = todayIso();
    const data = invoiceInputSchema.parse({
      clientId: client.id,
      language: client.language,
      issueDate: today,
      dueDate: defaultDueDate(today, settings.paymentTermDays),
      subject: labels.timeInvoiceSubject,
      siteTypeId: client.siteTypeId,
      ...texts(settings, client.language),
      globalDiscountType: "PERCENT",
      globalDiscountValue: "",
      lines,
    } satisfies InvoiceInput);
    const invoice = await createDraft(tx, actor, data, {
      source: { action: "invoice.created", details: { fromTime: client.displayName } },
    });
    const ids = entries.map((e) => e.id);
    const marked = await tx.timeEntry.updateMany({
      where: { id: { in: ids }, invoiceId: null },
      data: { invoiceId: invoice.id },
    });
    if (marked.count !== ids.length) {
      throw new UserError("Le temps a été modifié entre-temps. Rechargez la page.");
    }
    const minutes = entries.reduce((sum, e) => sum + e.minutes, 0);
    await logActivity(
      {
        userId: actor.id,
        action: "time.invoiced",
        entityType: "client",
        entityId: client.id,
        label: client.displayName,
        details: { hours: formatDuration(minutes), entries: entries.length, invoiceId: invoice.id },
      },
      tx,
    );
    return invoice;
  });
}

// ---------------------------------------------------------------------------
// Factures d'abonnement
// ---------------------------------------------------------------------------

/**
 * Facture (brouillon) d'une période d'abonnement. L'avancement de
 * l'abonnement est enregistré dans la même transaction, à condition qu'il
 * n'ait pas changé entre-temps ; la contrainte d'unicité (abonnement, début de
 * période) empêche en plus de facturer deux fois la même période.
 */
export async function createSubscriptionInvoice(
  subscription: {
    id: string;
    clientId: string;
    label: string;
    language: "FR" | "DE";
    siteTypeId: string | null;
    billedPeriods: number;
    lines: InvoiceInput["lines"];
  },
  period: { index: number; start: string; end: string; nextStart: string },
  today: string,
) {
  return db.$transaction(async (tx) => {
    const advanced = await tx.subscription.updateMany({
      where: { id: subscription.id, status: "ACTIVE", billedPeriods: subscription.billedPeriods },
      data: {
        billedPeriods: period.index + 1,
        nextBillingDate: isoToDbDate(period.nextStart),
        version: { increment: 1 },
      },
    });
    if (advanced.count === 0) return null;
    const settings = await getSettings(tx);
    const data = invoiceInputSchema.parse({
      clientId: subscription.clientId,
      language: subscription.language,
      issueDate: today,
      dueDate: defaultDueDate(today, settings.paymentTermDays),
      subject: subscription.label,
      siteTypeId: subscription.siteTypeId,
      ...texts(settings, subscription.language),
      globalDiscountType: "PERCENT",
      globalDiscountValue: "",
      lines: subscription.lines,
    } satisfies InvoiceInput);
    return createDraft(tx, null, data, {
      type: "SUBSCRIPTION",
      subscription: { id: subscription.id, periodStart: period.start, periodEnd: period.end },
      source: {
        action: "invoice.created",
        details: {
          fromSubscription: subscription.label,
          period: `${period.start} – ${period.end}`,
        },
      },
    });
  });
}

export async function createInvoiceFromQuote(
  actor: CurrentUser,
  quoteId: string,
  kind: ConversionKind,
) {
  return db.$transaction(async (tx) => {
    // Verrou sur le devis : deux clics simultanés ne créent pas deux factures.
    await tx.$queryRaw`SELECT id FROM "quote" WHERE id = ${quoteId} FOR UPDATE`;
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { lines: { orderBy: { position: "asc" } } },
    });
    if (!quote) throw new UserError("Ce devis n'existe plus.");
    if (quote.status !== "ACCEPTED") {
      throw new UserError("Seul un devis accepté peut être converti en facture.");
    }
    const oneTimeLines = quote.lines.filter((line) => line.lineType !== "SUBSCRIPTION");
    if (oneTimeLines.length === 0) {
      throw new UserError(
        "Ce devis ne contient que des abonnements : ils seront facturés par un abonnement, pas par une facture unique.",
      );
    }
    const hasDeposit = quote.depositCents > 0;
    if (kind === "DEPOSIT" && !hasDeposit)
      throw new UserError("Ce devis ne prévoit pas d'acompte.");
    if (kind === "STANDARD" && hasDeposit) {
      throw new UserError("Ce devis prévoit un acompte : créez d'abord la facture d'acompte.");
    }
    if (kind === "FINAL") {
      const deposits = await tx.invoice.count({
        where: { quoteId, type: "DEPOSIT", status: { notIn: ["DRAFT", "CANCELLED"] } },
      });
      if (deposits === 0) {
        throw new UserError("Émettez d'abord la facture d'acompte : la facture finale la déduira.");
      }
    }
    await assertNoActiveInvoice(tx, quoteId, kind);

    const settings = await getSettings(tx);
    const issueDate = todayIso();
    const base = {
      clientId: quote.clientId,
      language: quote.language,
      issueDate,
      dueDate: defaultDueDate(issueDate, settings.paymentTermDays),
      subject: quote.subject,
      siteTypeId: quote.siteTypeId,
      ...texts(settings, quote.language),
    };

    let input: InvoiceInput;
    if (kind === "DEPOSIT") {
      const labels = documentLabels(quote.language);
      const { totals, deposit } = storedDocumentTotals({ ...quote, lines: oneTimeLines });
      const label =
        deposit?.type === "PERCENT"
          ? fillLabel(labels.depositLinePercent, {
              percent: formatPercent(deposit.value),
              number: quote.number,
            })
          : fillLabel(labels.depositLineAmount, { number: quote.number });
      const parts = depositParts(totals.oneTime, quote.depositCents, settings.vatEnabled);
      input = {
        ...base,
        globalDiscountType: "PERCENT",
        globalDiscountValue: "",
        lines: parts.map((part) => ({
          catalogItemId: null,
          lineType: "FLAT",
          periodicity: null,
          label:
            parts.length > 1
              ? fillLabel(labels.depositLineVat, {
                  label,
                  rate: formatPercent(part.vatRateBps ?? 0),
                })
              : label,
          description: "",
          quantity: "1",
          unit: "FLAT",
          unitPrice: formatAmount(part.netCents),
          discountType: "PERCENT",
          discountValue: "",
          vatRateBps: part.vatRateBps,
        })),
      };
    } else {
      const discount = discountToInput(quote.globalDiscountType, quote.globalDiscountValue);
      input = {
        ...base,
        globalDiscountType: discount.type,
        globalDiscountValue: discount.value,
        lines: oneTimeLines.map((line) => ({
          ...storedLineToInput(line),
          vatRateBps: settings.vatEnabled ? (line.vatRateBps ?? settings.vatRates[0] ?? 0) : null,
        })),
      };
    }

    const data = invoiceInputSchema.parse(input);
    return createDraft(tx, actor, data, {
      type: kind,
      quoteId,
      source: { action: "invoice.created", details: { fromQuote: quote.number, kind } },
    });
  });
}

// ---------------------------------------------------------------------------
// Émission, annulation
// ---------------------------------------------------------------------------

/**
 * Émission : la facture reçoit son numéro (sans trou, dans la même
 * transaction), sa référence de paiement et les coordonnées figées. Elle ne
 * peut plus être modifiée ensuite.
 */
/** `actor` vide : émission par la tâche quotidienne (factures d'abonnement). */
export async function issueInvoice(actor: CurrentUser | null, id: string, version: number) {
  const issued = await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { client: true } });
    if (!invoice) throw new UserError("Cette facture n'existe plus.");
    if (invoice.status !== "DRAFT") throw new UserError("Cette facture a déjà été émise.");
    if (invoice.version !== version) {
      throw new UserError(
        "Cette facture vient d'être modifiée. Rechargez la page avant de l'émettre.",
      );
    }
    const settings = await getSettings(tx);

    // Facture finale : les acomptes sont relus (l'un d'eux a pu être annulé entre-temps).
    const deductions = await deductionsFor(tx, invoice);
    const deducted = deductions.reduce((sum, d) => sum + d.amountCents, 0);
    if (deducted > invoice.totalCents) {
      throw new UserError("Les acomptes déduits dépassent le total de la facture.");
    }
    const amountDue = invoice.totalCents - deducted;

    // La QR-facture exige un compte et l'adresse complète de l'entreprise.
    const company = companySnapshot(settings);
    const missing = missingQrRequirements({
      ...company,
      iban: settings.iban,
      qrIban: settings.qrIban,
    });
    if (amountDue > 0 && missing.length > 0) {
      throw new UserError(
        `Impossible d'émettre la facture : complétez dans Paramètres → Entreprise (nécessaire à la QR-facture) : ${missing.join(", ")}.`,
      );
    }

    const year = yearOf(dbDateToIso(invoice.issueDate));
    const { number, sequence } = await allocateDocumentNumber(
      tx,
      "INVOICE",
      year,
      settings.invoiceNumberFormat,
    );
    const setup = paymentSetup(settings, { number, year, sequence });

    const result = await tx.invoice.updateMany({
      where: { id, version, status: "DRAFT" },
      data: {
        deductions: deductions.length > 0 ? deductions : Prisma.DbNull,
        deductedCents: deducted,
        amountDueCents: amountDue,
        number,
        year,
        sequence,
        status: statusAfterPayments(amountDue, 0),
        issuedAt: new Date(),
        paymentAccount: setup?.account ?? "",
        referenceType: setup?.referenceType ?? null,
        paymentReference: setup?.reference ?? "",
        clientSnapshot: clientSnapshot(invoice.client),
        companySnapshot: company,
        searchText: invoiceSearchText(number, invoice.subject),
        updatedById: actor?.id ?? null,
        version: { increment: 1 },
      },
    });
    if (result.count === 0)
      throw new UserError("Cette facture vient de changer. Rechargez la page.");
    await log(tx, actor, "invoice.issued", { id, number });
    return { id, number };
  });
  return issued;
}

export async function cancelInvoice(actor: CurrentUser, id: string, reason: string) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw new UserError("Cette facture n'existe plus.");
  if (invoice.status === "DRAFT")
    throw new UserError("Un brouillon ne s'annule pas : supprimez-le.");
  if (!canCancel(invoice.status, invoice.paidCents)) {
    throw new UserError(
      invoice.status === "CANCELLED"
        ? "Cette facture est déjà annulée."
        : "Cette facture a des paiements enregistrés : supprimez-les avant de l'annuler.",
    );
  }
  await db.$transaction(async (tx) => {
    const result = await tx.invoice.updateMany({
      where: { id, status: "SENT", paidCents: 0 },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count === 0)
      throw new UserError("Cette facture vient de changer. Rechargez la page.");
    await log(tx, actor, "invoice.cancelled", invoice, { reason });
  });
}

// ---------------------------------------------------------------------------
// Paiements
// ---------------------------------------------------------------------------

async function lockInvoice(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "invoice" WHERE id = ${id} FOR UPDATE`;
  const invoice = await tx.invoice.findUnique({ where: { id } });
  if (!invoice) throw new UserError("Cette facture n'existe plus.");
  return invoice;
}

export async function recordPayment(actor: CurrentUser, payment: PaymentData) {
  if (payment.date > todayIso())
    throw new UserError("La date du paiement ne peut pas être dans le futur.");
  return db.$transaction(async (tx) => {
    const invoice = await lockInvoice(tx, payment.invoiceId);
    if (!isOpen(invoice.status)) {
      throw new UserError(
        `Impossible d'enregistrer un paiement sur une facture « ${INVOICE_STATUS_LABELS[invoice.status].toLowerCase()} ».`,
      );
    }
    const balance = outstandingCents(invoice);
    if (payment.amountCents > balance) {
      throw new UserError(`Le montant dépasse le solde de la facture (${formatChf(balance)}).`);
    }
    const paid = invoice.paidCents + payment.amountCents;
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        date: isoToDbDate(payment.date),
        amountCents: payment.amountCents,
        method: payment.method,
        note: payment.note,
        createdById: actor.id,
      },
    });
    const status = statusAfterPayments(owedCents(invoice), paid);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { paidCents: paid, status, version: { increment: 1 } },
    });
    await log(tx, actor, "payment.recorded", invoice, {
      amount: formatChf(payment.amountCents),
      method: PAYMENT_METHOD_LABELS[payment.method],
    });
    return { status, balanceCents: balanceCents(owedCents(invoice), paid) };
  });
}

export async function deletePayment(actor: CurrentUser, paymentId: string) {
  const existing = await db.payment.findUnique({ where: { id: paymentId } });
  if (!existing) throw new UserError("Ce paiement n'existe plus.");
  await db.$transaction(async (tx) => {
    const invoice = await lockInvoice(tx, existing.invoiceId);
    const deleted = await tx.payment.deleteMany({ where: { id: paymentId } });
    if (deleted.count === 0) throw new UserError("Ce paiement n'existe plus.");
    const paid = Math.max(0, invoice.paidCents - existing.amountCents);
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidCents: paid,
        status: statusAfterPayments(owedCents(invoice), paid),
        version: { increment: 1 },
      },
    });
    await log(tx, actor, "payment.deleted", invoice, { amount: formatChf(existing.amountCents) });
  });
}

/** Facture envoyée par email (elle a été émise juste avant si c'était un brouillon). */
export async function recordInvoiceEmailed(
  actor: CurrentUser | null,
  invoice: { id: string; number: string | null },
  recipients: string[],
) {
  await log(db, actor, "invoice.emailed", invoice, { to: recipients });
}

/** Échéance proposée pour une nouvelle facture datée d'aujourd'hui. */
export async function newInvoiceDates() {
  const settings = await getSettings();
  const issueDate = todayIso();
  return { issueDate, dueDate: addDays(issueDate, settings.paymentTermDays) };
}
