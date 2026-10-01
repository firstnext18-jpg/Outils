/**
 * Conversions entre une facture enregistrée et les valeurs du formulaire.
 * Module partagé navigateur / serveur.
 */
import { dbDateToIso } from "@/domain/dates";
import type { DiscountType } from "@/domain/totals";
import {
  discountToInput,
  previewDiscount,
  previewLines,
  storedLineToInput,
  type StoredLine,
} from "@/modules/documents/lines";
import type { InvoiceInput } from "@/modules/invoices/schemas";

type StoredInvoice = {
  clientId: string;
  language: "FR" | "DE";
  issueDate: Date;
  dueDate: Date;
  subject: string;
  siteTypeId: string | null;
  introText: string;
  conditionsText: string;
  globalDiscountType: DiscountType | null;
  globalDiscountValue: number;
  lines: StoredLine[];
};

export function invoiceToInput(invoice: StoredInvoice): InvoiceInput {
  const globalDiscount = discountToInput(invoice.globalDiscountType, invoice.globalDiscountValue);
  return {
    clientId: invoice.clientId,
    language: invoice.language,
    issueDate: dbDateToIso(invoice.issueDate),
    dueDate: dbDateToIso(invoice.dueDate),
    subject: invoice.subject,
    siteTypeId: invoice.siteTypeId,
    introText: invoice.introText,
    conditionsText: invoice.conditionsText,
    globalDiscountType: globalDiscount.type,
    globalDiscountValue: globalDiscount.value,
    lines: invoice.lines.map(storedLineToInput),
  };
}

/** Lecture tolérante pour les totaux affichés pendant la saisie. */
export function previewInvoiceTotalsInput(
  values: Pick<InvoiceInput, "lines" | "globalDiscountType" | "globalDiscountValue">,
) {
  return {
    lines: previewLines(values.lines),
    globalDiscount: previewDiscount(values.globalDiscountType, values.globalDiscountValue),
    deposit: null,
    separateRecurring: false,
  };
}
