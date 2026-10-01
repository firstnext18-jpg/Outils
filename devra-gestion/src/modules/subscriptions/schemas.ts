import { z } from "zod";
import { PERIODICITIES } from "@/domain/catalog";
import { isValidIsoDate } from "@/domain/dates";
import { MAX_UNIT_PRICE_CENTS, parseChfInput } from "@/domain/money";
import { MAX_QUANTITY_MILLI, parseQuantity } from "@/domain/quantity";
import { SUBSCRIPTION_STATUSES } from "@/domain/subscriptions";
import { DISCOUNT_TYPES, parseDiscountInput, text } from "@/modules/documents/lines";

/** Prestation d'un abonnement (montant par période). */
export const subscriptionItemSchema = z
  .object({
    catalogItemId: z.uuid().nullable(),
    label: text(200).min(1, "La désignation est obligatoire"),
    description: text(2000),
    quantity: z.string(),
    unitPrice: z.string(),
    discountType: z.enum(DISCOUNT_TYPES),
    discountValue: z.string(),
    vatRateBps: z.number().int().min(0).max(10_000).nullable(),
  })
  .superRefine((item, ctx) => {
    const quantity = parseQuantity(item.quantity);
    if (quantity === null || quantity === 0 || quantity > MAX_QUANTITY_MILLI) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantité invalide" });
    }
    const price = parseChfInput(item.unitPrice);
    if (price === null || price > MAX_UNIT_PRICE_CENTS) {
      ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "Prix invalide" });
    }
    const discount = parseDiscountInput(item.discountType, item.discountValue);
    if ("error" in discount) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: discount.error });
    }
  })
  .transform((item) => {
    const discount = parseDiscountInput(item.discountType, item.discountValue);
    return {
      catalogItemId: item.catalogItemId,
      label: item.label,
      description: item.description,
      quantityMilli: parseQuantity(item.quantity) ?? 0,
      unitPriceCents: parseChfInput(item.unitPrice) ?? 0,
      discount: "discount" in discount ? discount.discount : null,
      vatRateBps: item.vatRateBps,
    };
  });

export type SubscriptionItemInput = z.input<typeof subscriptionItemSchema>;
export type SubscriptionItemData = z.output<typeof subscriptionItemSchema>;

export const subscriptionInputSchema = z.object({
  clientId: z.uuid("Choisissez un client"),
  label: text(200).min(1, "Le libellé est obligatoire"),
  periodicity: z.enum(PERIODICITIES),
  startDate: z.string().refine(isValidIsoDate, "Date invalide"),
  language: z.enum(["FR", "DE"]),
  notes: text(2000),
  items: z
    .array(subscriptionItemSchema)
    .min(1, "Ajoutez au moins une prestation")
    .max(50, "50 prestations maximum"),
});

export type SubscriptionInput = z.input<typeof subscriptionInputSchema>;
export type SubscriptionData = z.output<typeof subscriptionInputSchema>;

const id = z.uuid("Identifiant invalide");

export const createSubscriptionSchema = z.object({ subscription: subscriptionInputSchema });
export const updateSubscriptionSchema = z.object({
  id,
  version: z.number().int().nonnegative(),
  subscription: subscriptionInputSchema,
});
export const subscriptionIdSchema = z.object({ id });
export const subscriptionFromQuoteSchema = z.object({
  quoteId: id,
  startDate: z.string().refine(isValidIsoDate, "Date invalide"),
});

export const SUBSCRIPTION_STATUS_PARAMS = {
  actifs: "ACTIVE",
  "en-pause": "PAUSED",
  resilies: "CANCELLED",
} as const satisfies Record<string, (typeof SUBSCRIPTION_STATUSES)[number]>;

export const subscriptionListParamsSchema = z.object({
  statut: z
    .preprocess(
      (v) => (Array.isArray(v) ? v[0] : v) || undefined,
      z
        .enum(Object.keys(SUBSCRIPTION_STATUS_PARAMS) as [keyof typeof SUBSCRIPTION_STATUS_PARAMS])
        .optional(),
    )
    .catch(undefined),
});
