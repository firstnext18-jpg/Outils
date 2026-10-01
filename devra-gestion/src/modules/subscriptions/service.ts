import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { PeriodicityCode } from "@/domain/catalog";
import { dbDateToIso, isoToDbDate, todayIso } from "@/domain/dates";
import { normalizeSearchText } from "@/domain/search";
import { duePeriods, indexAfterPause, periodStart, recurringRevenue } from "@/domain/subscriptions";
import { invoiceEmailDraft, sendInvoiceEmail } from "@/modules/emails/service";
import { createSubscriptionInvoice, getInvoice } from "@/modules/invoices/service";
import { itemToInvoiceLine, periodAmount } from "@/modules/subscriptions/amounts";
import { SUBSCRIPTION_STATUS_PARAMS, type SubscriptionData } from "@/modules/subscriptions/schemas";
import { getSettings } from "@/modules/settings/service";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db, type Tx } from "@/server/db";
import type { CurrentUser } from "@/server/session";

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

const listSelect = {
  id: true,
  label: true,
  status: true,
  periodicity: true,
  startDate: true,
  nextBillingDate: true,
  amountCents: true,
  client: { select: { id: true, displayName: true } },
} satisfies Prisma.SubscriptionSelect;

export type SubscriptionListRow = Prisma.SubscriptionGetPayload<{ select: typeof listSelect }>;

export function listSubscriptions(params: { statut?: keyof typeof SUBSCRIPTION_STATUS_PARAMS }) {
  return db.subscription.findMany({
    where: params.statut ? { status: SUBSCRIPTION_STATUS_PARAMS[params.statut] } : {},
    orderBy: [{ status: "asc" }, { nextBillingDate: "asc" }],
    select: listSelect,
  });
}

export function listClientSubscriptions(clientId: string) {
  return db.subscription.findMany({
    where: { clientId },
    orderBy: [{ status: "asc" }, { nextBillingDate: "asc" }],
    select: listSelect,
  });
}

/** Revenu récurrent (MRR, ARR) des abonnements actifs, hors TVA. */
export async function subscriptionRevenue() {
  const subscriptions = await db.subscription.findMany({
    select: { status: true, periodicity: true, amountCents: true },
  });
  return recurringRevenue(subscriptions);
}

export function getSubscription(id: string) {
  return db.subscription.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      client: true,
      quote: { select: { id: true, number: true } },
      createdBy: { select: { name: true } },
      invoices: {
        orderBy: { periodStart: "desc" },
        select: {
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
          periodStart: true,
          periodEnd: true,
          client: { select: { id: true, displayName: true } },
        },
      },
    },
  });
}

export type SubscriptionDetail = NonNullable<Awaited<ReturnType<typeof getSubscription>>>;

export function getSubscriptionActivity(id: string) {
  return db.activityLog.findMany({
    where: { entityType: "subscription", entityId: id },
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

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

async function log(
  tx: Tx | typeof db,
  actor: CurrentUser | null,
  action: Parameters<typeof logActivity>[0]["action"],
  subscription: { id: string; label: string },
  details?: Prisma.InputJsonValue,
) {
  await logActivity(
    {
      userId: actor?.id ?? null,
      action,
      entityType: "subscription",
      entityId: subscription.id,
      label: subscription.label,
      details,
    },
    tx,
  );
}

function itemRows(items: SubscriptionData["items"]) {
  return items.map((item, position) => ({
    position,
    catalogItemId: item.catalogItemId,
    label: item.label,
    description: item.description,
    quantityMilli: item.quantityMilli,
    unitPriceCents: item.unitPriceCents,
    discountType: item.discount?.type ?? null,
    discountValue: item.discount?.value ?? 0,
    vatRateBps: item.vatRateBps,
  }));
}

function columns(data: SubscriptionData, clientName: string) {
  const items = itemRows(data.items);
  return {
    items,
    columns: {
      clientId: data.clientId,
      label: data.label,
      periodicity: data.periodicity,
      language: data.language,
      notes: data.notes,
      amountCents: periodAmount(items),
      searchText: normalizeSearchText(`${data.label} ${clientName}`),
    },
  };
}

async function clientName(tx: Tx, clientId: string) {
  const client = await tx.client.findUnique({
    where: { id: clientId },
    select: { displayName: true },
  });
  if (!client) throw new UserError("Ce client n'existe plus. Choisissez-en un autre.");
  return client.displayName;
}

export async function createSubscription(
  actor: CurrentUser,
  data: SubscriptionData,
  source?: { quoteId: string; quoteNumber: string },
) {
  return db.$transaction(async (tx) => {
    const { columns: values, items } = columns(data, await clientName(tx, data.clientId));
    const subscription = await tx.subscription.create({
      data: {
        ...values,
        quoteId: source?.quoteId ?? null,
        startDate: isoToDbDate(data.startDate),
        nextBillingDate: isoToDbDate(data.startDate),
        createdById: actor.id,
        updatedById: actor.id,
        items: { create: items },
      },
    });
    await log(
      tx,
      actor,
      "subscription.created",
      subscription,
      source ? { fromQuote: source.quoteNumber } : undefined,
    );
    return subscription;
  });
}

export async function updateSubscription(
  actor: CurrentUser,
  id: string,
  version: number,
  data: SubscriptionData,
) {
  await db.$transaction(async (tx) => {
    const existing = await tx.subscription.findUnique({ where: { id } });
    if (!existing) throw new UserError("Cet abonnement n'existe plus.");
    if (existing.status === "CANCELLED")
      throw new UserError("Un abonnement résilié ne se modifie plus.");
    const billed = existing.billedPeriods > 0;
    if (billed && dbDateToIso(existing.startDate) !== data.startDate) {
      throw new UserError(
        "Des périodes ont déjà été facturées : la date de début ne peut plus changer.",
      );
    }
    if (billed && existing.periodicity !== data.periodicity) {
      throw new UserError(
        "Des périodes ont déjà été facturées : la périodicité ne peut plus changer. Résiliez l'abonnement et créez-en un nouveau.",
      );
    }
    const { columns: values, items } = columns(data, await clientName(tx, data.clientId));
    const result = await tx.subscription.updateMany({
      where: { id, version },
      data: {
        ...values,
        startDate: isoToDbDate(data.startDate),
        ...(billed ? {} : { nextBillingDate: isoToDbDate(data.startDate) }),
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new UserError(
        "Cet abonnement a été modifié par quelqu'un d'autre entre-temps. Rechargez la page.",
      );
    }
    await tx.subscriptionItem.deleteMany({ where: { subscriptionId: id } });
    await tx.subscriptionItem.createMany({
      data: items.map((item) => ({ ...item, subscriptionId: id })),
    });
    await log(tx, actor, "subscription.updated", existing);
  });
}

async function changeStatus(
  actor: CurrentUser,
  id: string,
  from: ("ACTIVE" | "PAUSED" | "CANCELLED")[],
  data: Prisma.SubscriptionUncheckedUpdateManyInput,
  action: "subscription.paused" | "subscription.resumed" | "subscription.cancelled",
) {
  const subscription = await db.subscription.findUnique({ where: { id } });
  if (!subscription) throw new UserError("Cet abonnement n'existe plus.");
  if (!from.includes(subscription.status)) {
    throw new UserError("Cette action n'est pas possible pour cet abonnement.");
  }
  await db.$transaction(async (tx) => {
    const result = await tx.subscription.updateMany({
      where: { id, status: subscription.status },
      data: { ...data, updatedById: actor.id, version: { increment: 1 } },
    });
    if (result.count === 0)
      throw new UserError("Cet abonnement vient de changer. Rechargez la page.");
    await log(tx, actor, action, subscription);
  });
  return subscription;
}

export function pauseSubscription(actor: CurrentUser, id: string) {
  return changeStatus(
    actor,
    id,
    ["ACTIVE"],
    { status: "PAUSED", pausedAt: new Date() },
    "subscription.paused",
  );
}

/** Reprise : les périodes écoulées pendant la pause ne sont pas facturées. */
export async function resumeSubscription(actor: CurrentUser, id: string) {
  const subscription = await db.subscription.findUnique({ where: { id } });
  if (!subscription) throw new UserError("Cet abonnement n'existe plus.");
  const startDate = dbDateToIso(subscription.startDate);
  const index = indexAfterPause(
    { startDate, periodicity: subscription.periodicity, billedPeriods: subscription.billedPeriods },
    todayIso(),
  );
  return changeStatus(
    actor,
    id,
    ["PAUSED"],
    {
      status: "ACTIVE",
      pausedAt: null,
      billedPeriods: index,
      nextBillingDate: isoToDbDate(periodStart(startDate, subscription.periodicity, index)),
    },
    "subscription.resumed",
  );
}

export function cancelSubscription(actor: CurrentUser, id: string) {
  return changeStatus(
    actor,
    id,
    ["ACTIVE", "PAUSED"],
    { status: "CANCELLED", endDate: isoToDbDate(todayIso()) },
    "subscription.cancelled",
  );
}

export async function deleteSubscription(actor: CurrentUser, id: string) {
  const subscription = await db.subscription.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true } } },
  });
  if (!subscription) throw new UserError("Cet abonnement n'existe plus.");
  if (subscription._count.invoices > 0) {
    throw new UserError(
      "Cet abonnement a déjà été facturé : résiliez-le plutôt que de le supprimer.",
    );
  }
  await db.$transaction(async (tx) => {
    await tx.subscription.delete({ where: { id } });
    await log(tx, actor, "subscription.deleted", subscription);
  });
}

/**
 * Abonnement(s) tiré(s) des lignes d'abonnement d'un devis accepté : un par
 * périodicité (ex. hébergement mensuel et nom de domaine annuel).
 */
export async function createSubscriptionsFromQuote(
  actor: CurrentUser,
  quoteId: string,
  startDate: string,
) {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!quote) throw new UserError("Ce devis n'existe plus.");
  if (quote.status !== "ACCEPTED") {
    throw new UserError("Seul un devis accepté peut donner lieu à un abonnement.");
  }
  const existing = await db.subscription.count({
    where: { quoteId, status: { not: "CANCELLED" } },
  });
  if (existing > 0) throw new UserError("Les abonnements de ce devis ont déjà été créés.");
  const lines = quote.lines.filter((line) => line.lineType === "SUBSCRIPTION");
  if (lines.length === 0) throw new UserError("Ce devis ne contient pas d'abonnement.");

  const groups = new Map<PeriodicityCode, typeof lines>();
  for (const line of lines) {
    const periodicity = line.periodicity ?? "MONTHLY";
    groups.set(periodicity, [...(groups.get(periodicity) ?? []), line]);
  }
  const created = [];
  for (const [periodicity, group] of groups) {
    const label = group
      .map((line) => line.label)
      .join(" + ")
      .slice(0, 200);
    created.push(
      await createSubscription(
        actor,
        {
          clientId: quote.clientId,
          label,
          periodicity,
          startDate,
          language: quote.language,
          notes: "",
          items: group.map((line) => ({
            catalogItemId: line.catalogItemId,
            label: line.label,
            description: line.description,
            quantityMilli: line.quantityMilli,
            unitPriceCents: line.unitPriceCents,
            discount:
              line.discountType && line.discountValue > 0
                ? { type: line.discountType, value: line.discountValue }
                : null,
            vatRateBps: line.vatRateBps,
          })),
        },
        { quoteId, quoteNumber: quote.number },
      ),
    );
  }
  return created;
}

// ---------------------------------------------------------------------------
// Facturation (tâche quotidienne)
// ---------------------------------------------------------------------------

/**
 * Génère les factures des périodes commencées des abonnements actifs (y
 * compris les périodes manquées). En brouillon par défaut ; si l'option est
 * activée et que le client a une adresse email, elles sont émises et envoyées.
 */
export async function billDueSubscriptions(today = todayIso()) {
  const settings = await getSettings();
  const subscriptions = await db.subscription.findMany({
    where: { status: "ACTIVE", nextBillingDate: { lte: isoToDbDate(today) } },
    include: { items: { orderBy: { position: "asc" } }, client: true },
  });
  const result = { invoices: 0, sent: 0, failed: 0, errors: [] as string[] };
  const defaultVat = settings.vatEnabled ? (settings.vatRates[0] ?? 0) : null;

  for (const subscription of subscriptions) {
    const startDate = dbDateToIso(subscription.startDate);
    let billedPeriods = subscription.billedPeriods;
    const periods = duePeriods(
      { startDate, periodicity: subscription.periodicity, billedPeriods },
      today,
    );
    for (const period of periods) {
      const lines = subscription.items.map((item) =>
        itemToInvoiceLine(
          item,
          subscription.periodicity,
          settings.vatEnabled ? (item.vatRateBps ?? defaultVat) : null,
        ),
      );
      let invoice;
      try {
        invoice = await createSubscriptionInvoice(
          {
            id: subscription.id,
            clientId: subscription.clientId,
            label: subscription.label,
            language: subscription.language,
            siteTypeId: subscription.client.siteTypeId,
            billedPeriods,
            lines,
          },
          {
            ...period,
            nextStart: periodStart(startDate, subscription.periodicity, period.index + 1),
          },
          today,
        );
      } catch (error) {
        // Période déjà facturée (contrainte d'unicité) : rien à faire.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") break;
        // Autre erreur : on passe à l'abonnement suivant, elle sera signalée.
        console.error(`Facturation de l'abonnement ${subscription.id} impossible`, error);
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`« ${subscription.label} » : ${message}`);
        break;
      }
      if (!invoice) break; // l'abonnement a changé entre-temps
      billedPeriods = period.index + 1;
      result.invoices += 1;
      await log(db, null, "subscription.invoiced", subscription, {
        period: `${period.start} – ${period.end}`,
      });

      if (settings.subscriptionAutoSend && subscription.client.email) {
        const detail = await getInvoice(invoice.id);
        if (!detail) continue;
        const draft = invoiceEmailDraft(detail, settings);
        try {
          await sendInvoiceEmail(null, {
            kind: "invoice",
            id: invoice.id,
            version: detail.version,
            to: [subscription.client.email],
            subject: draft.subject,
            body: draft.body,
            copyToSender: false,
          });
          result.sent += 1;
        } catch (error) {
          console.error(`Envoi de la facture d'abonnement ${invoice.id} impossible`, error);
          result.failed += 1;
        }
      }
    }
  }
  return result;
}
