import "server-only";
import { dbDateToIso, todayIso, type IsoDate } from "@/domain/dates";
import { messageExcerpt, MESSAGES_PAGE } from "@/domain/discussions";
import { displayStatus, outstandingCents } from "@/domain/invoice-status";
import { onlineQuoteState } from "@/domain/online-quote";
import { PORTAL_INVOICE_STATUSES, PORTAL_QUOTE_STATUSES } from "@/domain/portal";
import { ensureClientDiscussion } from "@/modules/discussions/service";
import { getInvoice } from "@/modules/invoices/service";
import { db } from "@/server/db";
import type { PortalSession } from "@/server/portal-session";
import { sendPush } from "@/server/push";

/**
 * Données de l'espace client. Chaque fonction reçoit l'identifiant du client
 * connecté (jamais une valeur venue du navigateur) et ne lit que ses
 * documents : devis hors brouillons, factures émises, abonnements, et sa
 * discussion avec l'équipe — jamais les discussions internes.
 */

export async function portalQuotes(clientId: string) {
  const today = todayIso();
  const quotes = await db.quote.findMany({
    where: { clientId, status: { in: [...PORTAL_QUOTE_STATUSES] } },
    orderBy: [{ issueDate: "desc" }, { sequence: "desc" }],
    select: {
      id: true,
      number: true,
      subject: true,
      status: true,
      issueDate: true,
      validUntil: true,
      totalCents: true,
      recurringMonthlyCents: true,
      recurringQuarterlyCents: true,
      recurringYearlyCents: true,
    },
  });
  return quotes.map((quote) => ({
    ...quote,
    state: onlineQuoteState(
      { status: quote.status, validUntil: dbDateToIso(quote.validUntil) },
      today,
    ),
  }));
}

export type PortalQuoteRow = Awaited<ReturnType<typeof portalQuotes>>[number];

export async function portalInvoices(clientId: string) {
  const today = todayIso();
  const invoices = await db.invoice.findMany({
    where: { clientId, status: { in: [...PORTAL_INVOICE_STATUSES] } },
    orderBy: [{ issueDate: "desc" }, { year: "desc" }, { sequence: "desc" }],
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
      paymentAccount: true,
      paymentReference: true,
      // Une relance accorde un nouveau délai : c'est lui qui compte pour le client.
      reminders: { orderBy: { level: "desc" }, take: 1, select: { dueDate: true } },
    },
  });
  return invoices.map(({ reminders, ...invoice }) => {
    const dueDate: IsoDate = dbDateToIso(reminders[0]?.dueDate ?? invoice.dueDate);
    return {
      ...invoice,
      dueDate,
      outstandingCents: outstandingCents(invoice),
      status: displayStatus(invoice.status, dueDate, today),
    };
  });
}

export type PortalInvoiceRow = Awaited<ReturnType<typeof portalInvoices>>[number];

/** Factures à payer : émises, pas entièrement payées. */
export function invoicesToPay(invoices: PortalInvoiceRow[]) {
  return invoices.filter(
    (i) =>
      (i.status === "SENT" || i.status === "PARTIALLY_PAID" || i.status === "OVERDUE") &&
      i.outstandingCents > 0,
  );
}

export function portalSubscriptions(clientId: string) {
  return db.subscription.findMany({
    where: { clientId },
    orderBy: [{ status: "asc" }, { nextBillingDate: "asc" }],
    select: {
      id: true,
      label: true,
      status: true,
      periodicity: true,
      startDate: true,
      nextBillingDate: true,
      endDate: true,
      amountCents: true,
    },
  });
}

export type PortalSubscriptionRow = Awaited<ReturnType<typeof portalSubscriptions>>[number];

/** Facture du client pour le PDF, si elle lui est visible. */
export async function portalInvoiceForPdf(clientId: string, invoiceId: string) {
  const invoice = await getInvoice(invoiceId);
  if (!invoice || invoice.clientId !== clientId) return null;
  if (!(PORTAL_INVOICE_STATUSES as readonly string[]).includes(invoice.status)) return null;
  return invoice;
}

// ---------------------------------------------------------------------------
// Discussion avec l'équipe
// ---------------------------------------------------------------------------

/** Messages de l'équipe que le client n'a pas encore lus. */
export async function portalUnreadCount(clientId: string): Promise<number> {
  const discussion = await db.discussion.findUnique({
    where: { portalClientId: clientId },
    select: { id: true, clientReadAt: true },
  });
  if (!discussion) return 0;
  return db.discussionMessage.count({
    where: {
      discussionId: discussion.id,
      fromClient: false,
      ...(discussion.clientReadAt ? { createdAt: { gt: discussion.clientReadAt } } : {}),
    },
  });
}

/** Messages de la discussion (les plus récents) et dernière lecture par l'équipe. */
export async function portalDiscussion(clientId: string) {
  const { id } = await ensureClientDiscussion(clientId);
  const [messages, teamRead] = await Promise.all([
    db.discussionMessage.findMany({
      where: { discussionId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MESSAGES_PAGE,
      select: {
        id: true,
        body: true,
        createdAt: true,
        fromClient: true,
        author: { select: { name: true } },
      },
    }),
    db.discussionRead.aggregate({
      where: { discussionId: id, user: { active: true } },
      _max: { lastReadAt: true },
    }),
  ]);
  return { id, messages: messages.reverse(), teamReadAt: teamRead._max.lastReadAt };
}

/** Message du client : l'équipe est prévenue (notifications sur ses appareils). */
export async function postClientMessage(session: PortalSession, body: string) {
  const { id } = await ensureClientDiscussion(session.client.id);
  const now = new Date();
  await db.$transaction([
    db.discussionMessage.create({
      data: { discussionId: id, fromClient: true, body, createdAt: now },
    }),
    db.discussion.update({ where: { id }, data: { lastMessageAt: now, clientReadAt: now } }),
  ]);
  return { id };
}

export async function notifyTeamOfClientMessage(
  session: PortalSession,
  discussionId: string,
  body: string,
) {
  const users = await db.user.findMany({ where: { active: true }, select: { id: true } });
  await sendPush(
    users.map((u) => u.id),
    {
      title: `${session.client.displayName} · Discussion avec le client`,
      body: `${session.client.displayName} : ${messageExcerpt(body, 140)}`,
      url: `/discussions/${discussionId}`,
      tag: `discussion-${discussionId}`,
    },
  );
}

/** Le client a lu la discussion jusqu'ici. */
export async function markPortalRead(clientId: string) {
  await db.discussion.updateMany({
    where: { portalClientId: clientId },
    data: { clientReadAt: new Date() },
  });
}
