import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { PAYMENT_METHODS } from "@/domain/invoice-status";
import { MAX_UNIT_PRICE_CENTS, parseChfInput } from "@/domain/money";
import {
  DISCOUNT_TYPES,
  documentLinesSchema,
  parseDiscountInput,
  text,
} from "@/modules/documents/lines";

// ---------------------------------------------------------------------------
// Facture (brouillon)
// ---------------------------------------------------------------------------

export const invoiceInputSchema = z
  .object({
    clientId: z.uuid("Choisissez un client"),
    language: z.enum(["FR", "DE"]),
    issueDate: z.string().refine(isValidIsoDate, "Date invalide"),
    dueDate: z.string().refine(isValidIsoDate, "Date invalide"),
    subject: text(200),
    siteTypeId: z.uuid().nullable(),
    introText: text(5000),
    conditionsText: text(5000),
    lines: documentLinesSchema,
    globalDiscountType: z.enum(DISCOUNT_TYPES),
    globalDiscountValue: z.string(),
  })
  .superRefine((invoice, ctx) => {
    if (
      isValidIsoDate(invoice.issueDate) &&
      isValidIsoDate(invoice.dueDate) &&
      invoice.dueDate < invoice.issueDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Doit être après la date de la facture",
      });
    }
    const discount = parseDiscountInput(invoice.globalDiscountType, invoice.globalDiscountValue);
    if ("error" in discount)
      ctx.addIssue({ code: "custom", path: ["globalDiscountValue"], message: discount.error });
  })
  .transform(({ globalDiscountType, globalDiscountValue, ...invoice }) => {
    const discount = parseDiscountInput(globalDiscountType, globalDiscountValue);
    return { ...invoice, globalDiscount: "discount" in discount ? discount.discount : null };
  });

export type InvoiceInput = z.input<typeof invoiceInputSchema>;
export type InvoiceData = z.output<typeof invoiceInputSchema>;

const id = z.uuid("Identifiant invalide");

export const createInvoiceSchema = z.object({ invoice: invoiceInputSchema });
export const updateInvoiceSchema = z.object({
  id,
  version: z.number().int().nonnegative(),
  invoice: invoiceInputSchema,
});
export const invoiceIdSchema = z.object({ id });
export const issueInvoiceSchema = z.object({ id, version: z.number().int().nonnegative() });
export const cancelInvoiceSchema = z.object({
  id,
  reason: text(500).min(3, "Indiquez le motif de l'annulation"),
});

/** Conversion d'un devis accepté : facture, facture d'acompte ou facture finale. */
export const createFromQuoteSchema = z.object({
  quoteId: id,
  kind: z.enum(["STANDARD", "DEPOSIT", "FINAL"]),
});

// ---------------------------------------------------------------------------
// Paiements
// ---------------------------------------------------------------------------

export const paymentInputSchema = z
  .object({
    invoiceId: id,
    date: z.string().refine(isValidIsoDate, "Date invalide"),
    amount: z.string(),
    method: z.enum(PAYMENT_METHODS),
    note: text(500),
  })
  .superRefine((payment, ctx) => {
    const cents = parseChfInput(payment.amount);
    if (cents === null || cents === 0 || cents > MAX_UNIT_PRICE_CENTS) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Montant invalide" });
    }
  })
  .transform(({ amount, ...payment }) => ({
    ...payment,
    amountCents: parseChfInput(amount) ?? 0,
  }));

export type PaymentInput = z.input<typeof paymentInputSchema>;
export type PaymentData = z.output<typeof paymentInputSchema>;

export const paymentIdSchema = z.object({ id });

// ---------------------------------------------------------------------------
// Liste : paramètres d'URL
// ---------------------------------------------------------------------------

/** Filtres de statut tels qu'affichés (« en retard » est calculé). */
export const INVOICE_STATUS_PARAMS = {
  brouillon: "DRAFT",
  envoyee: "SENT",
  "partiellement-payee": "PARTIALLY_PAID",
  payee: "PAID",
  "en-retard": "OVERDUE",
  annulee: "CANCELLED",
} as const;

const optionalParam = <T extends z.ZodType>(schema: T) =>
  z
    .preprocess((v) => (Array.isArray(v) ? v[0] : v) || undefined, schema.optional())
    .catch(undefined);

export const invoiceListParamsSchema = z.object({
  q: optionalParam(z.string().trim().max(100)),
  statut: optionalParam(
    z.enum(Object.keys(INVOICE_STATUS_PARAMS) as [keyof typeof INVOICE_STATUS_PARAMS]),
  ),
  page: optionalParam(z.coerce.number().int().min(1).max(10_000)),
});

export type InvoiceListParams = z.output<typeof invoiceListParamsSchema>;
