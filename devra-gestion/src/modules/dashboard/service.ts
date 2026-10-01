import "server-only";
import { cantonName, type CantonCode } from "@/domain/cantons";
import {
  conversionRate,
  lastMonths,
  type DashboardPeriod,
  type DateRange,
} from "@/domain/dashboard";
import {
  addDays,
  daysBetween,
  dbDateToIso,
  isoToDbDate,
  zurichMidnight,
  type IsoDate,
} from "@/domain/dates";
import { outstandingCents } from "@/domain/invoice-status";
import type { Prisma } from "@/generated/prisma/client";
import { subscriptionRevenue } from "@/modules/subscriptions/service";
import { db } from "@/server/db";

/**
 * Données du tableau de bord.
 *
 * Chiffre d'affaires facturé : montant à payer des factures émises (envoyées,
 * partiellement payées ou payées ; ni brouillons ni annulées), à leur date. Une
 * facture finale ne compte que son solde après déduction de l'acompte, déjà
 * compté avec la facture d'acompte. Encaissé : paiements reçus, à leur date.
 * Montants TVA comprise si elle est activée ; frais de relance non compris
 * dans le facturé.
 */

const ISSUED = ["SENT", "PARTIALLY_PAID", "PAID"] as const;
const OPEN = ["SENT", "PARTIALLY_PAID"] as const;

/** Délai (jours) en dessous duquel un devis en attente « expire bientôt ». */
export const EXPIRING_SOON_DAYS = 7;

function dateFilter(range: DateRange) {
  return { gte: isoToDbDate(range.from), lte: isoToDbDate(range.to) };
}

function issuedIn(range: DateRange): Prisma.InvoiceWhereInput {
  return { status: { in: [...ISSUED] }, issueDate: dateFilter(range) };
}

async function revenue(range: DateRange) {
  const [invoiced, paid] = await Promise.all([
    db.invoice.aggregate({
      where: issuedIn(range),
      _sum: { amountDueCents: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: { date: dateFilter(range), invoice: { status: { not: "CANCELLED" } } },
      _sum: { amountCents: true },
    }),
  ]);
  return {
    invoicedCents: invoiced._sum.amountDueCents ?? 0,
    invoiceCount: invoiced._count,
    paidCents: paid._sum.amountCents ?? 0,
  };
}

/** Facturé et encaissé des 12 derniers mois (jusqu'au mois en cours). */
async function monthlyRevenue(today: IsoDate) {
  const months = lastMonths(today);
  const range = { from: months[0]!.range.from, to: months.at(-1)!.range.to };
  const [invoiced, paid] = await Promise.all([
    db.invoice.groupBy({
      by: ["issueDate"],
      where: issuedIn(range),
      _sum: { amountDueCents: true },
    }),
    db.payment.groupBy({
      by: ["date"],
      where: { date: dateFilter(range), invoice: { status: { not: "CANCELLED" } } },
      _sum: { amountCents: true },
    }),
  ]);
  const rows = new Map(months.map((m) => [m.month, { invoicedCents: 0, paidCents: 0 }]));
  for (const row of invoiced) {
    const month = rows.get(dbDateToIso(row.issueDate).slice(0, 7));
    if (month) month.invoicedCents += row._sum.amountDueCents ?? 0;
  }
  for (const row of paid) {
    const month = rows.get(dbDateToIso(row.date).slice(0, 7));
    if (month) month.paidCents += row._sum.amountCents ?? 0;
  }
  return months.map((m) => ({ month: m.month, ...rows.get(m.month)! }));
}

/** Factures émises pas encore payées, et celles dont l'échéance est dépassée. */
async function unpaidInvoices(today: IsoDate) {
  const open = { status: { in: [...OPEN] } } satisfies Prisma.InvoiceWhereInput;
  const overdue = { ...open, dueDate: { lt: isoToDbDate(today) } };
  const sums = { amountDueCents: true, feesCents: true, paidCents: true } as const;
  const [all, late, list] = await Promise.all([
    db.invoice.aggregate({ where: open, _sum: sums, _count: true }),
    db.invoice.aggregate({ where: overdue, _sum: sums, _count: true }),
    db.invoice.findMany({
      where: overdue,
      orderBy: [{ dueDate: "asc" }, { sequence: "asc" }],
      take: 5,
      select: {
        id: true,
        number: true,
        dueDate: true,
        amountDueCents: true,
        feesCents: true,
        paidCents: true,
        client: { select: { id: true, displayName: true } },
      },
    }),
  ]);
  const total = (sum: typeof all._sum) =>
    outstandingCents({
      amountDueCents: sum.amountDueCents ?? 0,
      feesCents: sum.feesCents ?? 0,
      paidCents: sum.paidCents ?? 0,
    });
  return {
    count: all._count,
    totalCents: total(all._sum),
    overdueCount: late._count,
    overdueCents: total(late._sum),
    overdue: list.map((invoice) => ({
      id: invoice.id,
      number: invoice.number!,
      client: invoice.client,
      dueDate: dbDateToIso(invoice.dueDate),
      daysLate: daysBetween(dbDateToIso(invoice.dueDate), today),
      balanceCents: outstandingCents(invoice),
    })),
  };
}

/** Devis envoyés encore valables, et ceux qui expirent dans les prochains jours. */
async function pendingQuotes(today: IsoDate) {
  const pending = {
    status: "SENT",
    validUntil: { gte: isoToDbDate(today) },
  } satisfies Prisma.QuoteWhereInput;
  const soon = {
    ...pending,
    validUntil: { gte: isoToDbDate(today), lte: isoToDbDate(addDays(today, EXPIRING_SOON_DAYS)) },
  };
  const [all, expiringCount, expiring] = await Promise.all([
    db.quote.aggregate({ where: pending, _sum: { totalCents: true }, _count: true }),
    db.quote.count({ where: soon }),
    db.quote.findMany({
      where: soon,
      orderBy: [{ validUntil: "asc" }, { sequence: "asc" }],
      take: 5,
      select: {
        id: true,
        number: true,
        validUntil: true,
        totalCents: true,
        client: { select: { id: true, displayName: true } },
      },
    }),
  ]);
  return {
    count: all._count,
    totalCents: all._sum.totalCents ?? 0,
    expiringCount,
    expiring: expiring.map((quote) => ({
      ...quote,
      validUntil: dbDateToIso(quote.validUntil),
      daysLeft: daysBetween(today, dbDateToIso(quote.validUntil)),
    })),
  };
}

/** Devis envoyés pendant la période (date d'envoi, à Zurich) et ce qu'ils sont devenus. */
async function quoteConversion(range: DateRange) {
  const rows = await db.quote.groupBy({
    by: ["status"],
    where: {
      status: { not: "DRAFT" },
      sentAt: { gte: zurichMidnight(range.from), lt: zurichMidnight(addDays(range.to, 1)) },
    },
    _count: true,
  });
  const count = (status: string) => rows.find((r) => r.status === status)?._count ?? 0;
  const sent = rows.reduce((sum, r) => sum + r._count, 0);
  const accepted = count("ACCEPTED");
  return {
    sent,
    accepted,
    refused: count("REFUSED"),
    pending: count("SENT"),
    rate: conversionRate(sent, accepted),
  };
}

/** Les 5 clients qui ont le plus été facturés pendant la période. */
async function topClients(range: DateRange) {
  const rows = await db.invoice.groupBy({
    by: ["clientId"],
    where: issuedIn(range),
    _sum: { amountDueCents: true },
    _count: true,
    orderBy: { _sum: { amountDueCents: "desc" } },
    take: 5,
  });
  const clients = await db.client.findMany({
    where: { id: { in: rows.map((r) => r.clientId) } },
    select: { id: true, displayName: true, city: true },
  });
  return rows.map((row) => ({
    client: clients.find((c) => c.id === row.clientId)!,
    invoicedCents: row._sum.amountDueCents ?? 0,
    invoiceCount: row._count,
  }));
}

export type ZoneRow = { key: string; label: string; revenueCents: number; clients: number };

function sortZones(rows: Map<string, ZoneRow>) {
  return [...rows.values()].sort(
    (a, b) =>
      b.revenueCents - a.revenueCents ||
      b.clients - a.clients ||
      a.label.localeCompare(b.label, "fr"),
  );
}

/**
 * Zones d'action : chiffre d'affaires facturé pendant la période et nombre de
 * clients (fichier actuel, sans les archivés), par canton et par localité,
 * d'après l'adresse actuelle des clients.
 */
async function zones(range: DateRange) {
  const [revenueByClient, clientsByCanton, clientsByCity] = await Promise.all([
    db.invoice.groupBy({
      by: ["clientId"],
      where: issuedIn(range),
      _sum: { amountDueCents: true },
    }),
    db.client.groupBy({ by: ["canton"], where: { archivedAt: null }, _count: true }),
    db.client.groupBy({
      by: ["postalCode", "city"],
      where: { archivedAt: null },
      _count: true,
    }),
  ]);
  const invoicedClients = await db.client.findMany({
    where: { id: { in: revenueByClient.map((r) => r.clientId) } },
    select: { id: true, canton: true, postalCode: true, city: true },
  });

  const cantonLabel = (code: CantonCode | null) =>
    code ? `${cantonName(code)} (${code})` : "Canton non renseigné";
  const cityKey = (postalCode: string, city: string) =>
    `${postalCode.trim()} ${city.trim()}`.trim();
  const cantons = new Map<string, ZoneRow>();
  const cities = new Map<string, ZoneRow>();
  const row = (map: Map<string, ZoneRow>, key: string, label: string) => {
    let entry = map.get(key);
    if (!entry) map.set(key, (entry = { key, label, revenueCents: 0, clients: 0 }));
    return entry;
  };

  for (const group of clientsByCanton) {
    row(cantons, group.canton ?? "", cantonLabel(group.canton)).clients += group._count;
  }
  for (const group of clientsByCity) {
    const key = cityKey(group.postalCode, group.city);
    row(cities, key, key || "Localité non renseignée").clients += group._count;
  }
  for (const group of revenueByClient) {
    const client = invoicedClients.find((c) => c.id === group.clientId);
    if (!client) continue;
    const cents = group._sum.amountDueCents ?? 0;
    row(cantons, client.canton ?? "", cantonLabel(client.canton)).revenueCents += cents;
    const key = cityKey(client.postalCode, client.city);
    row(cities, key, key || "Localité non renseignée").revenueCents += cents;
  }
  return { cantons: sortZones(cantons), cities: sortZones(cities).slice(0, 10) };
}

/**
 * Types de site : demandés (fiches clients actuelles, sans les archivés) et
 * vendus (chiffre d'affaires facturé pendant la période).
 */
async function siteTypes(range: DateRange) {
  const [demanded, sold, types] = await Promise.all([
    db.client.groupBy({ by: ["siteTypeId"], where: { archivedAt: null }, _count: true }),
    db.invoice.groupBy({
      by: ["siteTypeId"],
      where: issuedIn(range),
      _sum: { amountDueCents: true },
    }),
    db.siteType.findMany({ select: { id: true, name: true } }),
  ]);
  const name = (id: string | null) =>
    (id && types.find((t) => t.id === id)?.name) || "Non renseigné";
  return {
    demanded: demanded
      .map((r) => ({ key: r.siteTypeId ?? "", label: name(r.siteTypeId), value: r._count }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "fr")),
    sold: sold
      .map((r) => ({
        key: r.siteTypeId ?? "",
        label: name(r.siteTypeId),
        value: r._sum.amountDueCents ?? 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "fr")),
  };
}

async function recurring() {
  const [revenue, active] = await Promise.all([
    subscriptionRevenue(),
    db.subscription.count({ where: { status: "ACTIVE" } }),
  ]);
  return { ...revenue, active };
}

export async function getDashboard(period: DashboardPeriod, today: IsoDate) {
  const [current, previous, monthly, unpaid, quotes, conversion, top, zoneRows, types, mrr] =
    await Promise.all([
      revenue(period.current),
      revenue(period.previous),
      monthlyRevenue(today),
      unpaidInvoices(today),
      pendingQuotes(today),
      quoteConversion(period.current),
      topClients(period.current),
      zones(period.current),
      siteTypes(period.current),
      recurring(),
    ]);
  return {
    revenue: { current, previous },
    monthly,
    unpaid,
    quotes,
    conversion,
    topClients: top,
    zones: zoneRows,
    siteTypes: types,
    recurring: mrr,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** Factures ouvertes proposées par le raccourci « Enregistrer un paiement ». */
export async function openInvoicesForPayment() {
  const invoices = await db.invoice.findMany({
    where: { status: { in: [...OPEN] } },
    orderBy: [{ dueDate: "asc" }, { sequence: "asc" }],
    take: 200,
    select: {
      id: true,
      number: true,
      dueDate: true,
      amountDueCents: true,
      feesCents: true,
      paidCents: true,
      client: { select: { displayName: true } },
    },
  });
  return invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number!,
    client: invoice.client.displayName,
    dueDate: dbDateToIso(invoice.dueDate),
    balanceCents: outstandingCents(invoice),
  }));
}

export type OpenInvoice = Awaited<ReturnType<typeof openInvoicesForPayment>>[number];
