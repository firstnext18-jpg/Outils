/**
 * Lignes des documents (devis et factures) : schéma de validation, conversions
 * entre données enregistrées et formulaire, calcul des totaux enregistrés.
 * Module partagé navigateur / serveur.
 */
import { z } from "zod";
import {
  allowedUnits,
  LINE_TYPES,
  PERIODICITIES,
  PERIODICITY_UNIT,
  type LineTypeCode,
  type PeriodicityCode,
} from "@/domain/catalog";
import { MAX_UNIT_PRICE_CENTS, parseChfInput } from "@/domain/money";
import { formatPercentValue, parsePercent } from "@/domain/percent";
import { formatQuantity, MAX_QUANTITY_MILLI, parseQuantity } from "@/domain/quantity";
import { computeTotals, type CalcLine, type Discount, type DiscountType } from "@/domain/totals";
import { UNITS, type UnitCode } from "@/domain/units";
import { formatAmount } from "@/lib/format";

export const DISCOUNT_TYPES = ["PERCENT", "AMOUNT"] as const;

export const text = (max: number) => z.string().trim().max(max, `${max} caractères maximum`);

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
// Schéma d'une ligne
// ---------------------------------------------------------------------------

export const documentLineInputSchema = z
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

export type DocumentLineInput = z.input<typeof documentLineInputSchema>;
export type DocumentLineData = z.output<typeof documentLineInputSchema>;

export const documentLinesSchema = z
  .array(documentLineInputSchema)
  .min(1, "Ajoutez au moins une ligne")
  .max(200, "200 lignes maximum");

// ---------------------------------------------------------------------------
// Formulaire
// ---------------------------------------------------------------------------

export function discountToInput(
  type: DiscountType | null,
  value: number,
): { type: DiscountType; value: string } {
  if (!type || value <= 0) return { type: type ?? "PERCENT", value: "" };
  return { type, value: type === "PERCENT" ? formatPercentValue(value) : formatAmount(value) };
}

/** Ligne vide (« ligne libre »). */
export function emptyLine(vatRateBps: number | null): DocumentLineInput {
  return {
    catalogItemId: null,
    lineType: "FLAT",
    periodicity: null,
    label: "",
    description: "",
    quantity: "1",
    unit: "FLAT",
    unitPrice: "",
    discountType: "PERCENT",
    discountValue: "",
    vatRateBps,
  };
}

/** Ligne reprise du catalogue, dans la langue du document (allemand si disponible). */
export function lineFromCatalog(
  item: {
    id: string;
    name: string;
    nameDe: string;
    description: string;
    descriptionDe: string;
    lineType: LineTypeCode;
    periodicity: PeriodicityCode | null;
    unit: UnitCode;
    unitPriceCents: number;
  },
  language: "FR" | "DE",
  vatRateBps: number | null,
): DocumentLineInput {
  const german = language === "DE";
  return {
    catalogItemId: item.id,
    lineType: item.lineType,
    periodicity: item.periodicity,
    label: (german && item.nameDe) || item.name,
    description: (german && item.descriptionDe) || item.description,
    quantity: "1",
    unit:
      item.lineType === "SUBSCRIPTION"
        ? PERIODICITY_UNIT[item.periodicity ?? "MONTHLY"]
        : item.unit,
    unitPrice: formatAmount(item.unitPriceCents),
    discountType: "PERCENT",
    discountValue: "",
    vatRateBps,
  };
}

/** Ligne enregistrée (devis ou facture). */
export type StoredLine = {
  catalogItemId: string | null;
  lineType: LineTypeCode;
  periodicity: PeriodicityCode | null;
  label: string;
  description: string;
  quantityMilli: number;
  unit: UnitCode;
  unitPriceCents: number;
  discountType: DiscountType | null;
  discountValue: number;
  vatRateBps: number | null;
};

export function storedLineToInput(line: StoredLine): DocumentLineInput {
  const discount = discountToInput(line.discountType, line.discountValue);
  return {
    catalogItemId: line.catalogItemId,
    lineType: line.lineType,
    periodicity: line.periodicity,
    label: line.label,
    description: line.description,
    quantity: formatQuantity(line.quantityMilli),
    unit: line.unit,
    unitPrice: formatAmount(line.unitPriceCents),
    discountType: discount.type,
    discountValue: discount.value,
    vatRateBps: line.vatRateBps,
  };
}

function discountOf(type: DiscountType, value: string): Discount {
  const parsed = parseDiscountInput(type, value);
  return "discount" in parsed ? parsed.discount : null;
}

/**
 * Lecture « tolérante » des lignes du formulaire pour afficher les totaux
 * pendant la saisie : une valeur encore invalide compte pour zéro (la
 * validation stricte a lieu à l'enregistrement).
 */
export function previewLines(lines: DocumentLineInput[]): CalcLine[] {
  return lines.map((line) => ({
    lineType: line.lineType,
    periodicity: line.lineType === "SUBSCRIPTION" ? line.periodicity : null,
    quantityMilli: parseQuantity(line.quantity) ?? 0,
    unitPriceCents: parseChfInput(line.unitPrice) ?? 0,
    discount: discountOf(line.discountType, line.discountValue),
    vatRateBps: line.vatRateBps,
  }));
}

export function previewDiscount(type: DiscountType, value: string): Discount {
  return discountOf(type, value);
}

// ---------------------------------------------------------------------------
// Totaux d'un document enregistré
// ---------------------------------------------------------------------------

export function storedDiscount(type: DiscountType | null, value: number): Discount {
  return type && value > 0 ? { type, value } : null;
}

/** Totaux d'un document enregistré (mêmes calculs qu'à l'enregistrement). */
export function storedDocumentTotals(
  doc: {
    lines: Omit<StoredLine, "catalogItemId" | "label" | "description" | "unit">[];
    globalDiscountType: DiscountType | null;
    globalDiscountValue: number;
    depositType?: DiscountType | null;
    depositValue?: number;
    vatEnabled: boolean;
  },
  options: { separateRecurring?: boolean } = {},
) {
  const globalDiscount = storedDiscount(doc.globalDiscountType, doc.globalDiscountValue);
  const deposit = storedDiscount(doc.depositType ?? null, doc.depositValue ?? 0);
  const totals = computeTotals({
    lines: doc.lines.map((line) => ({
      lineType: line.lineType,
      periodicity: line.periodicity,
      quantityMilli: line.quantityMilli,
      unitPriceCents: line.unitPriceCents,
      discount: storedDiscount(line.discountType, line.discountValue),
      vatRateBps: line.vatRateBps,
    })),
    globalDiscount,
    deposit,
    vatEnabled: doc.vatEnabled,
    separateRecurring: options.separateRecurring,
  });
  return { totals, globalDiscount, deposit };
}

/** Lignes enregistrées (position, montant net) à partir des données validées. */
export function lineRows(lines: DocumentLineData[], netCents: number[], vatEnabled: boolean) {
  return lines.map((line, position) => ({
    position,
    catalogItemId: line.catalogItemId,
    lineType: line.lineType,
    periodicity: line.periodicity,
    label: line.label,
    description: line.description,
    quantityMilli: line.quantityMilli,
    unit: line.unit,
    unitPriceCents: line.unitPriceCents,
    discountType: line.discount?.type ?? null,
    discountValue: line.discount?.value ?? 0,
    vatRateBps: vatEnabled ? line.vatRateBps : null,
    netCents: netCents[position]!,
  }));
}

/** Les montants sont stockés en entiers 32 bits : environ 21 millions de francs au maximum. */
export const MAX_STORED_CENTS = 2_000_000_000;
