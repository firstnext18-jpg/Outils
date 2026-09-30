import { z } from "zod";
import { allowedUnits, LINE_TYPES, PERIODICITIES } from "@/domain/catalog";
import { isValidIsoDate } from "@/domain/dates";
import { MAX_UNIT_PRICE_CENTS, parseChfInput } from "@/domain/money";
import { parsePercent } from "@/domain/percent";
import { MAX_QUANTITY_MILLI, parseQuantity } from "@/domain/quantity";
import type { Discount } from "@/domain/totals";
import { UNITS } from "@/domain/units";

export const DISCOUNT_TYPES = ["PERCENT", "AMOUNT"] as const;

const text = (max: number) => z.string().trim().max(max, `${max} caractères maximum`);

/**
 * Remise saisie (type + valeur texte) → remise calculable. Valeur vide = pas
 * de remise. Renvoie un message d'erreur si la saisie est invalide.
 */
export function parseDiscountInput(
  type: (typeof DISCOUNT_TYPES)[number],
  value: string,
): { discount: Discount } | { error: string } {
  if (!value.trim()) return { discount: null };
  if (type === "PERCENT") {
    const bps = parsePercent(value);
    return bps === null
      ? { error: "Pourcentage invalide (0 à 100)" }
      : { discount: bps ? { type, value: bps } : null };
  }
  const cents = parseChfInput(value);
  if (cents === null) return { error: "Montant invalide" };
  if (cents > MAX_UNIT_PRICE_CENTS) return { error: "Montant trop élevé" };
  return { discount: cents ? { type, value: cents } : null };
}

// ---------------------------------------------------------------------------
// Ligne
// ---------------------------------------------------------------------------

export const quoteLineInputSchema = z
  .object({
    catalogItemId: z.uuid().nullable(),
    lineType: z.enum(LINE_TYPES),
    periodicity: z.enum(PERIODICITIES).nullable(),
    label: text(200).min(1, "La désignation est obligatoire"),
    description: text(2000),
    quantity: z.string(),
    unit: z.enum(UNITS),
    unitPrice: z.string(),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.string(),
    vatRateBps: z.number().int().min(0).max(10_000).nullable(),
  })
  .superRefine((line, ctx) => {
    const quantity = parseQuantity(line.quantity);
    if (quantity === null || quantity === 0 || quantity > MAX_QUANTITY_MILLI) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantité invalide" });
    }
    const price = parseChfInput(line.unitPrice);
    if (price === null || price > MAX_UNIT_PRICE_CENTS) {
      ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "Prix invalide" });
    }
    const discount = parseDiscountInput(line.discountType, line.discountValue);
    if ("error" in discount)
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: discount.error });
    if (line.lineType === "SUBSCRIPTION" && !line.periodicity) {
      ctx.addIssue({ code: "custom", path: ["periodicity"], message: "Périodicité requise" });
    }
    const periodicity = line.lineType === "SUBSCRIPTION" ? line.periodicity : null;
    if (!allowedUnits(line.lineType, periodicity).includes(line.unit)) {
      ctx.addIssue({ code: "custom", path: ["unit"], message: "Unité incompatible" });
    }
  })
  .transform((line) => {
    const discount = parseDiscountInput(line.discountType, line.discountValue);
    return {
      catalogItemId: line.catalogItemId,
      lineType: line.lineType,
      periodicity: line.lineType === "SUBSCRIPTION" ? line.periodicity : null,
      label: line.label,
      description: line.description,
      quantityMilli: parseQuantity(line.quantity) ?? 0,
      unit: line.unit,
      unitPriceCents: parseChfInput(line.unitPrice) ?? 0,
      discount: "discount" in discount ? discount.discount : null,
      vatRateBps: line.vatRateBps,
    };
  });

export type QuoteLineInput = z.input<typeof quoteLineInputSchema>;
export type QuoteLineData = z.output<typeof quoteLineInputSchema>;

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
    lines: z
      .array(quoteLineInputSchema)
      .min(1, "Ajoutez au moins une ligne")
      .max(200, "200 lignes maximum"),
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
