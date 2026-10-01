import "server-only";
import { zipSync, type Zippable } from "fflate";
import { z } from "zod";
import type { ExportColumn, ExportValue } from "@/domain/accounting";
import { cantonName } from "@/domain/cantons";
import { CLIENT_KIND_LABELS } from "@/domain/clients";
import type { DateRange } from "@/domain/dashboard";
import { dbDateToIso, isoToDbDate, isValidIsoDate, todayIso } from "@/domain/dates";
import {
  displayStatus,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  outstandingCents,
  PAYMENT_METHOD_LABELS,
} from "@/domain/invoice-status";
import { getInvoice } from "@/modules/invoices/service";
import type { ClientSnapshot } from "@/modules/settings/documents";
import { getSettings } from "@/modules/settings/service";
import { db } from "@/server/db";
import { invoicePdfForDownload } from "@/server/pdf/invoice-pdf";
import { reminderPdfForDownload } from "@/server/pdf/reminder-pdf";
import type { TypedSheet } from "@/server/spreadsheet";

/** Nombre maximal de PDF dans une archive (mémoire du Raspberry Pi). */
export const MAX_PDFS_PER_ARCHIVE = 500;

/** Période d'export : `?du=AAAA-MM-JJ&au=AAAA-MM-JJ`. */
export const exportRangeSchema = z
  .object({
    du: z.string().refine(isValidIsoDate, "Date de début invalide"),
    au: z.string().refine(isValidIsoDate, "Date de fin invalide"),
  })
  .refine((range) => range.du <= range.au, "La date de début doit précéder la date de fin.")
  .transform(({ du, au }): DateRange => ({ from: du, to: au }));

function dates(range: DateRange) {
  return { gte: isoToDbDate(range.from), lte: isoToDbDate(range.to) };
}

/** Factures émises (annulées comprises : la suite des numéros reste complète). */
function invoicesIn(range: DateRange) {
  return { status: { not: "DRAFT" as const }, issueDate: dates(range) };
}

/** Nom du client tel qu'il figure sur la facture émise. */
function invoiceClientName(invoice: { clientSnapshot: unknown; client: { displayName: string } }) {
  return (
    (invoice.clientSnapshot as ClientSnapshot | null)?.displayName || invoice.client.displayName
  );
}

const INVOICE_COLUMNS: ExportColumn[] = [
  { header: "Numéro", type: "text" },
  { header: "Type", type: "text" },
  { header: "Statut", type: "text" },
  { header: "Date", type: "date" },
  { header: "Échéance", type: "date" },
  { header: "Client", type: "text" },
  { header: "Objet", type: "text" },
  { header: "Devis", type: "text" },
  { header: "Période du", type: "date" },
  { header: "Période au", type: "date" },
  { header: "Sous-total", type: "amount" },
  { header: "Remise", type: "amount" },
  { header: "TVA", type: "amount" },
  { header: "Total", type: "amount" },
  { header: "Acompte déduit", type: "amount" },
  { header: "Montant à payer", type: "amount" },
  { header: "Frais de relance", type: "amount" },
  { header: "Payé", type: "amount" },
  { header: "Solde", type: "amount" },
  { header: "Référence de paiement", type: "text" },
  { header: "Annulée le", type: "date" },
  { header: "Motif d'annulation", type: "text" },
];

async function invoiceSheet(range: DateRange): Promise<TypedSheet> {
  const today = todayIso();
  const invoices = await db.invoice.findMany({
    where: invoicesIn(range),
    orderBy: [{ year: "asc" }, { sequence: "asc" }],
    include: {
      client: { select: { displayName: true } },
      quote: { select: { number: true } },
    },
  });
  const rows: ExportValue[][] = invoices.map((invoice) => {
    const cancelled = invoice.status === "CANCELLED";
    const dueDate = dbDateToIso(invoice.dueDate);
    return [
      invoice.number,
      INVOICE_TYPE_LABELS[invoice.type],
      INVOICE_STATUS_LABELS[displayStatus(invoice.status, dueDate, today)],
      dbDateToIso(invoice.issueDate),
      dueDate,
      invoiceClientName(invoice),
      invoice.subject,
      invoice.quote?.number ?? "",
      invoice.periodStart ? dbDateToIso(invoice.periodStart) : null,
      invoice.periodEnd ? dbDateToIso(invoice.periodEnd) : null,
      invoice.subtotalCents,
      invoice.discountCents,
      invoice.vatCents,
      invoice.totalCents,
      invoice.deductedCents,
      invoice.amountDueCents,
      invoice.feesCents,
      invoice.paidCents,
      cancelled ? 0 : outstandingCents(invoice),
      invoice.paymentReference,
      invoice.cancelledAt ? dbDateToIso(invoice.cancelledAt) : null,
      invoice.cancelReason,
    ];
  });
  return { name: "Factures", columns: INVOICE_COLUMNS, rows };
}

const PAYMENT_COLUMNS: ExportColumn[] = [
  { header: "Date", type: "date" },
  { header: "Facture", type: "text" },
  { header: "Client", type: "text" },
  { header: "Montant", type: "amount" },
  { header: "Moyen de paiement", type: "text" },
  { header: "Note", type: "text" },
  { header: "Saisi par", type: "text" },
];

async function paymentSheet(range: DateRange): Promise<TypedSheet> {
  const payments = await db.payment.findMany({
    where: { date: dates(range) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      invoice: {
        select: {
          number: true,
          clientSnapshot: true,
          client: { select: { displayName: true } },
        },
      },
      createdBy: { select: { name: true } },
    },
  });
  const rows: ExportValue[][] = payments.map((payment) => [
    dbDateToIso(payment.date),
    payment.invoice.number,
    invoiceClientName(payment.invoice),
    payment.amountCents,
    PAYMENT_METHOD_LABELS[payment.method],
    payment.note,
    payment.createdBy?.name ?? "",
  ]);
  return { name: "Paiements", columns: PAYMENT_COLUMNS, rows };
}

const CLIENT_COLUMNS: ExportColumn[] = [
  { header: "Client", type: "text" },
  { header: "Type", type: "text" },
  { header: "Rue", type: "text" },
  { header: "Numéro", type: "text" },
  { header: "NPA", type: "text" },
  { header: "Localité", type: "text" },
  { header: "Canton", type: "text" },
  { header: "Pays", type: "text" },
  { header: "Email", type: "text" },
  { header: "Téléphone", type: "text" },
  { header: "Facturé sur la période", type: "amount" },
  { header: "Encaissé sur la période", type: "amount" },
  { header: "Solde ouvert à ce jour", type: "amount" },
];

/** Clients facturés ou ayant payé pendant la période, avec leurs totaux. */
async function clientSheet(range: DateRange): Promise<TypedSheet> {
  const [invoiced, paid] = await Promise.all([
    db.invoice.groupBy({
      by: ["clientId"],
      where: { ...invoicesIn(range), status: { in: ["SENT", "PARTIALLY_PAID", "PAID"] } },
      _sum: { amountDueCents: true },
    }),
    db.payment.findMany({
      where: { date: dates(range) },
      select: { amountCents: true, invoice: { select: { clientId: true } } },
    }),
  ]);
  const paidByClient = new Map<string, number>();
  for (const payment of paid) {
    const id = payment.invoice.clientId;
    paidByClient.set(id, (paidByClient.get(id) ?? 0) + payment.amountCents);
  }
  const ids = [...new Set([...invoiced.map((r) => r.clientId), ...paidByClient.keys()])];
  const [clients, open] = await Promise.all([
    db.client.findMany({ where: { id: { in: ids } }, orderBy: { sortName: "asc" } }),
    db.invoice.groupBy({
      by: ["clientId"],
      where: { clientId: { in: ids }, status: { in: ["SENT", "PARTIALLY_PAID"] } },
      _sum: { amountDueCents: true, feesCents: true, paidCents: true },
    }),
  ]);
  const rows: ExportValue[][] = clients.map((client) => {
    const openSums = open.find((r) => r.clientId === client.id)?._sum;
    return [
      client.displayName,
      CLIENT_KIND_LABELS[client.kind],
      client.street,
      client.streetNumber,
      client.postalCode,
      client.city,
      client.canton ? cantonName(client.canton) : "",
      client.country,
      client.email,
      client.phone,
      invoiced.find((r) => r.clientId === client.id)?._sum.amountDueCents ?? 0,
      paidByClient.get(client.id) ?? 0,
      openSums
        ? outstandingCents({
            amountDueCents: openSums.amountDueCents ?? 0,
            feesCents: openSums.feesCents ?? 0,
            paidCents: openSums.paidCents ?? 0,
          })
        : 0,
    ];
  });
  return { name: "Clients", columns: CLIENT_COLUMNS, rows };
}

export const EXPORT_DATASETS = {
  factures: { label: "Factures", build: invoiceSheet },
  paiements: { label: "Paiements", build: paymentSheet },
  clients: { label: "Clients", build: clientSheet },
} as const;

export type ExportDataset = keyof typeof EXPORT_DATASETS;

/** Nombre de documents de la période (affiché avant le téléchargement). */
export async function exportCounts(range: DateRange) {
  const [invoices, payments, reminders] = await Promise.all([
    db.invoice.count({ where: invoicesIn(range) }),
    db.payment.count({ where: { date: dates(range) } }),
    db.reminder.count({ where: { date: dates(range) } }),
  ]);
  return { invoices, payments, reminders };
}

/**
 * Archive ZIP des PDF de la période : factures émises (dossier « factures »)
 * et relances (dossier « relances »). Les PDF sont déjà compressés : ils sont
 * stockés tels quels dans l'archive.
 */
export async function pdfArchive(range: DateRange) {
  const [invoices, reminders, settings] = await Promise.all([
    db.invoice.findMany({
      where: invoicesIn(range),
      orderBy: [{ year: "asc" }, { sequence: "asc" }],
      select: { id: true },
    }),
    db.reminder.findMany({
      where: { date: dates(range) },
      orderBy: [{ date: "asc" }, { level: "asc" }],
    }),
    getSettings(),
  ]);
  const count = invoices.length + reminders.length;
  if (count > MAX_PDFS_PER_ARCHIVE) return { ok: false as const, count };

  const files: Zippable = {};
  const add = (folder: string, fileName: string, buffer: Uint8Array) => {
    let name = `${folder}/${fileName}`;
    for (let i = 2; name in files; i++)
      name = `${folder}/${fileName.replace(/\.pdf$/, `_${i}.pdf`)}`;
    files[name] = [new Uint8Array(buffer), { level: 0 }];
  };
  // Une à la fois : le Raspberry Pi garde peu de documents en mémoire en même temps.
  for (const { id } of invoices) {
    const invoice = await getInvoice(id);
    if (!invoice) continue;
    const { buffer, fileName } = await invoicePdfForDownload(invoice, settings);
    add("factures", fileName, buffer);
  }
  for (const reminder of reminders) {
    const invoice = await getInvoice(reminder.invoiceId);
    if (!invoice) continue;
    const { buffer, fileName } = await reminderPdfForDownload(reminder, invoice, settings);
    add("relances", fileName, buffer);
  }
  return { ok: true as const, count, zip: zipSync(files) };
}
