import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import {
  DISCOUNT_TYPES,
  documentLinesSchema,
  parseDiscountInput,
  text,
} from "@/modules/documents/lines";

// ---------------------------------------------------------------------------
// Devis
// ---------------------------------------------------------------------------

export const quoteInputSchema = z
  .object({
    clientId: z.uuid("Choisissez un client"),
    language: z.enum(["FR", "DE"]),
    issueDate: z.string().refine(isValidIsoDate, "Date invalide"),
    validUntil: z.string().refine(isValidIsoDate, "Date invalide"),
    subject: text(200),
    siteTypeId: z.uuid().nullable(),
    introText: text(5000),
    conditionsText: text(5000),
    lines: documentLinesSchema,
    globalDiscountType: z.enum(DISCOUNT_TYPES),
    globalDiscountValue: z.string(),
    depositType: z.enum(DISCOUNT_TYPES),
    depositValue: z.string(),
  })
  .superRefine((quote, ctx) => {
    if (
      isValidIsoDate(quote.issueDate) &&
      isValidIsoDate(quote.validUntil) &&
      quote.validUntil < quote.issueDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "Doit être après la date du devis",
      });
    }
    const discount = parseDiscountInput(quote.globalDiscountType, quote.globalDiscountValue);
    if ("error" in discount)
      ctx.addIssue({ code: "custom", path: ["globalDiscountValue"], message: discount.error });
    const deposit = parseDiscountInput(quote.depositType, quote.depositValue);
    if ("error" in deposit)
      ctx.addIssue({ code: "custom", path: ["depositValue"], message: deposit.error });
  })
  .transform(({ globalDiscountType, globalDiscountValue, depositType, depositValue, ...quote }) => {
    const discount = parseDiscountInput(globalDiscountType, globalDiscountValue);
    const deposit = parseDiscountInput(depositType, depositValue);
    return {
      ...quote,
      globalDiscount: "discount" in discount ? discount.discount : null,
      deposit: "discount" in deposit ? deposit.discount : null,
    };
  });

export type QuoteInput = z.input<typeof quoteInputSchema>;
export type QuoteData = z.output<typeof quoteInputSchema>;

const id = z.uuid("Identifiant invalide");

export const createQuoteSchema = z.object({ quote: quoteInputSchema });
export const updateQuoteSchema = z.object({
  id,
  version: z.number().int().nonnegative(),
  quote: quoteInputSchema,
});
export const quoteIdSchema = z.object({ id });
export const changeQuoteStatusSchema = z.object({
  id,
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REFUSED"]),
});

// ---------------------------------------------------------------------------
// Liste : paramètres d'URL
// ---------------------------------------------------------------------------

export const QUOTE_STATUS_PARAMS = {
  brouillon: "DRAFT",
  envoye: "SENT",
  accepte: "ACCEPTED",
  refuse: "REFUSED",
  expire: "EXPIRED",
} as const;

const optionalParam = <T extends z.ZodType>(schema: T) =>
  z
    .preprocess((v) => (Array.isArray(v) ? v[0] : v) || undefined, schema.optional())
    .catch(undefined);

export const quoteListParamsSchema = z.object({
  q: optionalParam(z.string().trim().max(100)),
  statut: optionalParam(
    z.enum(Object.keys(QUOTE_STATUS_PARAMS) as [keyof typeof QUOTE_STATUS_PARAMS]),
  ),
  page: optionalParam(z.coerce.number().int().min(1).max(10_000)),
});

export type QuoteListParams = z.output<typeof quoteListParamsSchema>;
