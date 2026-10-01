import "server-only";
import { dbDateToIso, formatIsoDate, type IsoDate } from "@/domain/dates";
import { documentFileName } from "@/domain/file-names";
import { buildQrBillData } from "@/domain/qr-bill";
import type { ReminderLevel } from "@/domain/reminders";
import { documentLabels, fillLabel } from "@/i18n/documents";
import { formatAmount } from "@/lib/format";
import { computeTotals } from "@/domain/totals";
import type { InvoiceDetail } from "@/modules/invoices/service";
import { clientSnapshot, companySnapshot, type ClientSnapshot } from "@/modules/settings/documents";
import type { AppSettings } from "@/modules/settings/service";
import { renderDocumentPdf, type TotalRow } from "@/server/pdf/document-pdf";
import { invoiceTitleLabel } from "@/server/pdf/invoice-pdf";
import { pdfRecipient } from "@/server/pdf/quote-pdf";
import { db } from "@/server/db";
import { readDocumentPdf, readUpload, saveDocumentPdf } from "@/server/storage";

export type ReminderPdfInput = {
  invoice: InvoiceDetail;
  level: ReminderLevel;
  date: IsoDate;
  dueDate: IsoDate;
  feeCents: number;
  totalCents: number;
  /** Texte de la relance, variables déjà remplacées. */
  text: string;
};

export function reminderPdfFileName(
  invoice: InvoiceDetail,
  level: ReminderLevel,
  settings: AppSettings,
) {
  const labels = documentLabels(invoice.language);
  const client =
    (invoice.clientSnapshot as ClientSnapshot | null) ?? clientSnapshot(invoice.client);
  return documentFileName(
    settings.companyName.trim(),
    `${labels.reminderFile}-${level}`,
    invoice.number ?? "",
    client.displayName,
  );
}

/**
 * PDF d'une relance : lettre, récapitulatif (facture, déjà payé, frais, montant
 * à payer) et nouvelle QR-facture du montant à payer, avec la même référence
 * que la facture (le paiement se rapproche ainsi de la facture).
 */
export async function buildReminderPdf(input: ReminderPdfInput, settings: AppSettings) {
  const { invoice, level } = input;
  const labels = documentLabels(invoice.language);
  const company = companySnapshot(settings);
  const client =
    (invoice.clientSnapshot as ClientSnapshot | null) ?? clientSnapshot(invoice.client);
  const logo = company.logoFile ? await readUpload(company.logoFile) : null;
  const levelLabel = labels[`reminder${level}`];
  const title = `${levelLabel} – ${invoiceTitleLabel(invoice.type, labels)} ${invoice.number}`;
  const chf = (cents: number) => `${labels.currency} ${formatAmount(cents)}`;

  const rows: TotalRow[] = [
    {
      label: fillLabel(labels.invoiceAmount, { number: invoice.number ?? "" }),
      value: chf(invoice.amountDueCents),
    },
  ];
  if (invoice.paidCents > 0)
    rows.push({ label: labels.alreadyPaid, value: chf(-invoice.paidCents) });
  if (invoice.feesCents > 0)
    rows.push({ label: labels.previousFees, value: chf(invoice.feesCents) });
  if (input.feeCents > 0) rows.push({ label: labels.reminderFee, value: chf(input.feeCents) });
  rows.push({ label: labels.amountDue, value: chf(input.totalCents), bold: true, ruleAbove: true });

  const qrBill =
    invoice.paymentAccount && invoice.referenceType && input.totalCents > 0
      ? buildQrBillData({
          setup: {
            account: invoice.paymentAccount,
            referenceType: invoice.referenceType,
            reference: invoice.paymentReference,
          },
          creditor: company,
          debtor: { ...client, name: client.displayName },
          amountCents: input.totalCents,
          message: fillLabel(labels.reminderQrMessage, { number: invoice.number ?? "" }),
        })
      : null;

  const buffer = await renderDocumentPdf({
    language: invoice.language,
    title,
    watermark: null,
    company,
    logo,
    recipient: pdfRecipient(client, invoice.language),
    meta: [
      [labels.date, formatIsoDate(input.date)],
      [labels.invoiceDate, formatIsoDate(dbDateToIso(invoice.issueDate))],
      [labels.originalDueDate, formatIsoDate(dbDateToIso(invoice.dueDate))],
      [labels.newDueDate, formatIsoDate(input.dueDate)],
    ],
    intro: input.text,
    lines: [],
    // Totaux non utilisés (récapitulatif fourni) : structure vide.
    totals: computeTotals({ lines: [], globalDiscount: null, deposit: null, vatEnabled: false }),
    globalDiscount: null,
    deposit: null,
    vatEnabled: true,
    summaryRows: rows,
    conditions: "",
    qrBill,
    info: { title, subject: client.displayName },
  });
  return { buffer, fileName: reminderPdfFileName(invoice, level, settings) };
}

/**
 * PDF d'une relance : celui archivé à l'envoi, ou régénéré à partir du texte
 * enregistré (puis archivé) s'il manque.
 */
export async function reminderPdfForDownload(
  reminder: {
    id: string;
    level: number;
    date: Date;
    dueDate: Date;
    feeCents: number;
    totalCents: number;
    text: string;
    pdfFile: string | null;
  },
  invoice: InvoiceDetail,
  settings: AppSettings,
) {
  const level = reminder.level as ReminderLevel;
  const fileName = reminderPdfFileName(invoice, level, settings);
  const archived = reminder.pdfFile ? await readDocumentPdf("reminders", reminder.id) : null;
  if (archived) return { buffer: archived, fileName };
  // Montants de la facture au moment de la relance : frais de cette relance non encore comptés.
  const previous = { ...invoice, feesCents: invoice.feesCents - reminder.feeCents };
  const { buffer } = await buildReminderPdf(
    {
      invoice: previous,
      level,
      date: dbDateToIso(reminder.date),
      dueDate: dbDateToIso(reminder.dueDate),
      feeCents: reminder.feeCents,
      totalCents: reminder.totalCents,
      text: reminder.text,
    },
    settings,
  );
  const file = await saveDocumentPdf("reminders", reminder.id, buffer).catch(() => null);
  if (file) await db.reminder.update({ where: { id: reminder.id }, data: { pdfFile: file } });
  return { buffer, fileName };
}
