import { z } from "zod";
import { allowedUnits, LINE_TYPES, PERIODICITIES, type LineTypeCode } from "@/domain/catalog";
import { MAX_UNIT_PRICE_CENTS, parseChfInput } from "@/domain/money";
import { UNITS } from "@/domain/units";

const text = (max: number) => z.string().trim().max(max, `${max} caractères maximum`);

/**
 * Prestation du catalogue. Le prix est saisi en texte (« 1'490.00 ») et
 * converti en centimes.
 */
export const catalogItemInputSchema = z
  .object({
    name: text(120).min(1, "Le nom est obligatoire"),
    nameDe: text(120),
    description: text(1000),
    descriptionDe: text(1000),
    category: text(50),
    lineType: z.enum(LINE_TYPES),
    periodicity: z.enum(PERIODICITIES).nullable(),
    unit: z.enum(UNITS),
    unitPrice: z.string(),
  })
  .superRefine((item, ctx) => {
    const cents = parseChfInput(item.unitPrice);
    if (cents === null) {
      ctx.addIssue({
        code: "custom",
        path: ["unitPrice"],
        message: "Montant invalide (ex. 1'490.00)",
      });
    } else if (cents > MAX_UNIT_PRICE_CENTS) {
      ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "Montant trop élevé" });
    }
    if (item.lineType === "SUBSCRIPTION" && !item.periodicity) {
      ctx.addIssue({ code: "custom", path: ["periodicity"], message: "Choisissez la périodicité" });
    }
    const periodicity = item.lineType === "SUBSCRIPTION" ? item.periodicity : null;
    if (!allowedUnits(item.lineType, periodicity).includes(item.unit)) {
      ctx.addIssue({ code: "custom", path: ["unit"], message: "Unité incompatible avec ce type" });
    }
  })
  .transform(({ unitPrice, ...item }) => ({
    ...item,
    periodicity: item.lineType === "SUBSCRIPTION" ? item.periodicity : null,
    unitPriceCents: parseChfInput(unitPrice) ?? 0,
  }));

export type CatalogItemInput = z.input<typeof catalogItemInputSchema>;
export type CatalogItemData = z.output<typeof catalogItemInputSchema>;

export const EMPTY_CATALOG_ITEM: CatalogItemInput = {
  name: "",
  nameDe: "",
  description: "",
  descriptionDe: "",
  category: "",
  lineType: "FLAT",
  periodicity: null,
  unit: "FLAT",
  unitPrice: "",
};

const id = z.uuid("Identifiant invalide");

export const createCatalogItemSchema = z.object({ item: catalogItemInputSchema });
export const updateCatalogItemSchema = z.object({
  id,
  version: z.number().int().nonnegative(),
  item: catalogItemInputSchema,
});
export const catalogItemIdSchema = z.object({ id });
export const setCatalogItemActiveSchema = z.object({ id, active: z.boolean() });

// ---------------------------------------------------------------------------
// Liste : paramètres d'URL
// ---------------------------------------------------------------------------

/** Filtre « type » dans l'URL (en français) → type de ligne. */
export const LINE_TYPE_PARAMS = {
  forfait: "FLAT",
  heure: "HOURLY",
  supplement: "EXTRA",
  abonnement: "SUBSCRIPTION",
} as const satisfies Record<string, LineTypeCode>;

const optionalParam = <T extends z.ZodType>(schema: T) =>
  z
    .preprocess((v) => (Array.isArray(v) ? v[0] : v) || undefined, schema.optional())
    .catch(undefined);

export const catalogListParamsSchema = z.object({
  q: optionalParam(z.string().trim().max(100)),
  type: optionalParam(z.enum(Object.keys(LINE_TYPE_PARAMS) as [keyof typeof LINE_TYPE_PARAMS])),
  categorie: optionalParam(z.string().max(50)),
  statut: optionalParam(z.enum(["actives", "inactives", "toutes"])),
});

export type CatalogListParams = z.output<typeof catalogListParamsSchema>;
