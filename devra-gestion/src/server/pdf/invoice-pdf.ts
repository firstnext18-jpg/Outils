import "server-only";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { documentFileName } from "@/domain/file-names";
import type { InvoiceType } from "@/domain/invoice-status";
import type { Deduction } from "@/domain/invoices";
import { buildQrBillData } from "@/domain/qr-bill";
import { documentLabels, fillLabel, type DocumentLabels } from "@/i18n/documents";
import { storedDiscount, storedDocumentTotals } from "@/modules/documents/lines";
import { getInvoice, type InvoiceDetail } from "@/modules/invoices/service";
import {
  clientSnapshot,
  companySnapshot,
  type ClientSnapshot,
  type CompanySnapshot,
} from "@/modules/settings/documents";
import { getSettings, type AppSettings } from "@/modules/settings/service";
import { db } from "@/server/db";
import { renderDocumentPdf } from "@/server/pdf/document-pdf";
import { pdfRecipient } from "@/server/pdf/quote-pdf";
import { readDocumentPdf, readUpload, saveDocumentPdf } from "@/server/storage";

export function invoiceTitleLabel(type: InvoiceType, labels: DocumentLabels): string {
  return {
    STANDARD: labels.invoice,
    DEPOSIT: labels.depositInvoice,
    FINAL: labels.finalInvoice,
    SUBSCRIPTION: labels.subscriptionInvoice,
  }[type];
}

function capitalize(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function snapshots(invoice: InvoiceDetail, settings: AppSettings) {
  return {
    company: (invoice.companySnapshot as CompanySnapshot | null) ?? companySnapshot(settings),
    client: (invoice.clientSnapshot as ClientSnapshot | null) ?? clientSnapshot(invoice.client),
  };
}

/** « Devra_Facture_F-2026-001_Client.pdf » (« Brouillon » tant qu'il n'y a pas de numéro). */
export function invoicePdfFileName(invoice: InvoiceDetail, settings: AppSettings) {
  const labels = documentLabels(invoice.language);
  const { company, client } = snapshots(invoice, settings);
  return documentFileName(
    company.name,
    labels.invoice,
    invoice.number ?? capitalize(labels.draft),
    client.displayName,
  );
}

/**
 * PDF d'une facture. Une facture émise utilise les coordonnées, le compte et
 * la référence figés à l'émission ; un brouillon, les données actuelles, avec
 * un filigrane et sans QR-facture (pas encore de numéro ni de référence).
 */
export async function buildInvoicePdf(
  invoice: InvoiceDetail,
  settings: AppSettings,
  options: { uncompressed?: boolean } = {},
) {
  const labels = documentLabels(invoice.language);
  const { company, client } = snapshots(invoice, settings);
  const logo = company.logoFile ? await readUpload(company.logoFile) : null;
  const { totals, globalDiscount } = storedDocumentTotals(invoice, { separateRecurring: false });
  const deductions = (invoice.deductions as Deduction[] | null) ?? [];
  const typeLabel = invoiceTitleLabel(invoice.type, labels);
  const title = invoice.number ? `${typeLabel} ${invoice.number}` : typeLabel;

  const meta: [string, string][] = [
    [labels.date, formatIsoDate(dbDateToIso(invoice.issueDate))],
    [labels.dueDate, formatIsoDate(dbDateToIso(invoice.dueDate))],
  ];
  if (invoice.periodStart && invoice.periodEnd) {
    meta.push([
      labels.period,
      `${formatIsoDate(dbDateToIso(invoice.periodStart))} – ${formatIsoDate(dbDateToIso(invoice.periodEnd))}`,
    ]);
  }
  if (invoice.quote) meta.push([labels.quoteReference, invoice.quote.number]);
  if (invoice.subject) meta.push([labels.subject, invoice.subject]);

  const payable =
    invoice.number &&
    invoice.status !== "CANCELLED" &&
    invoice.amountDueCents > 0 &&
    invoice.referenceType !== null &&
    invoice.paymentAccount;
  const qrBill = payable
    ? buildQrBillData({
        setup: {
          account: invoice.paymentAccount,
          referenceType: invoice.referenceType!,
          reference: invoice.paymentReference,
        },
        creditor: company,
        debtor: { ...client, name: client.displayName },
        amountCents: invoice.amountDueCents,
        message: fillLabel(labels.qrMessage, { number: invoice.number! }),
      })
    : null;

  const watermark =
    invoice.status === "DRAFT"
      ? labels.draft
      : invoice.status === "CANCELLED"
        ? labels.cancelled
        : null;

  const buffer = await renderDocumentPdf({
    language: invoice.language,
    title,
    watermark,
    company,
    logo,
    recipient: pdfRecipient(client, invoice.language),
    meta,
    intro: invoice.introText,
    lines: invoice.lines.map((line) => ({
      lineType: line.lineType,
      periodicity: line.periodicity,
      label: line.label,
      description: line.description,
      quantityMilli: line.quantityMilli,
      unit: line.unit,
      unitPriceCents: line.unitPriceCents,
      discount: storedDiscount(line.discountType, line.discountValue),
      netCents: line.netCents,
    })),
    totals,
    globalDiscount,
    deposit: null,
    vatEnabled: invoice.vatEnabled,
    separateRecurring: false,
    deductions,
    conditions: invoice.conditionsText,
    qrBill,
    info: { title, subject: invoice.subject || client.displayName },
    uncompressed: options.uncompressed,
  });

  return { buffer, fileName: invoicePdfFileName(invoice, settings) };
}

/** Génère et archive le PDF d'une facture émise. */
export async function archiveInvoicePdf(id: string) {
  const [invoice, settings] = await Promise.all([getInvoice(id), getSettings()]);
  if (!invoice || invoice.status === "DRAFT") return null;
  const { buffer } = await buildInvoicePdf(invoice, settings);
  const file = await saveDocumentPdf("invoices", id, buffer);
  await db.invoice.update({ where: { id }, data: { pdfFile: file } });
  return buffer;
}

/**
 * PDF à servir : celui archivé à l'émission pour une facture émise (régénéré
 * et archivé s'il manque), le document actuel pour un brouillon, et pour une
 * facture annulée le document archivé recomposé avec la mention « annulée ».
 */
export async function invoicePdfForDownload(invoice: InvoiceDetail, settings: AppSettings) {
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
    return buildInvoicePdf(invoice, settings);
  }
  const archived = invoice.pdfFile ? await readDocumentPdf("invoices", invoice.id) : null;
  if (archived) return { buffer: archived, fileName: invoicePdfFileName(invoice, settings) };
  const generated = await buildInvoicePdf(invoice, settings);
  const file = await saveDocumentPdf("invoices", invoice.id, generated.buffer).catch(() => null);
  if (file) await db.invoice.update({ where: { id: invoice.id }, data: { pdfFile: file } });
  return generated;
}
