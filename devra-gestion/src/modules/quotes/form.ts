/**
 * Conversions entre les données enregistrées et les valeurs du formulaire de
 * devis (textes saisis). Module partagé navigateur / serveur.
 */
import { defaultUnit, PERIODICITY_UNIT, type LineTypeCode } from "@/domain/catalog";
import { dbDateToIso } from "@/domain/dates";
import { parseChfInput } from "@/domain/money";
import { formatPercentValue } from "@/domain/percent";
import { formatQuantity, parseQuantity } from "@/domain/quantity";
import type { DiscountType } from "@/domain/totals";
import type { UnitCode } from "@/domain/units";
import { formatAmount } from "@/lib/format";
import { parseDiscountInput, type QuoteInput, type QuoteLineInput } from "@/modules/quotes/schemas";

export function discountToInput(
  type: DiscountType | null,
  value: number,
): {
  type: DiscountType;
  value: string;
} {
  if (!type || value <= 0) return { type: type ?? "PERCENT", value: "" };
  return { type, value: type === "PERCENT" ? formatPercentValue(value) : formatAmount(value) };
}

/** Ligne vide (« ligne libre »). */
export function emptyLine(vatRateBps: number | null): QuoteLineInput {
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

/** Ligne reprise du catalogue, dans la langue du devis (allemand si disponible). */
export function lineFromCatalog(
  item: {
    id: string;
    name: string;
    nameDe: string;
    description: string;
    descriptionDe: string;
    lineType: LineTypeCode;
    periodicity: QuoteLineInput["periodicity"];
    unit: UnitCode;
    unitPriceCents: number;
  },
  language: "FR" | "DE",
  vatRateBps: number | null,
): QuoteLineInput {
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

/** Unité par défaut quand le type d'une ligne change. */
export { defaultUnit };

type StoredQuote = {
  clientId: string;
  language: "FR" | "DE";
  issueDate: Date;
  validUntil: Date;
  subject: string;
  siteTypeId: string | null;
  introText: string;
  conditionsText: string;
  globalDiscountType: DiscountType | null;
  globalDiscountValue: number;
  depositType: DiscountType | null;
  depositValue: number;
  lines: {
    catalogItemId: string | null;
    lineType: LineTypeCode;
    periodicity: QuoteLineInput["periodicity"];
    label: string;
    description: string;
    quantityMilli: number;
    unit: UnitCode;
    unitPriceCents: number;
    discountType: DiscountType | null;
    discountValue: number;
    vatRateBps: number | null;
  }[];
};

/** Devis enregistré → valeurs du formulaire de modification (ou de duplication). */
export function quoteToInput(quote: StoredQuote): QuoteInput {
  const globalDiscount = discountToInput(quote.globalDiscountType, quote.globalDiscountValue);
  const deposit = discountToInput(quote.depositType, quote.depositValue);
  return {
    clientId: quote.clientId,
    language: quote.language,
    issueDate: dbDateToIso(quote.issueDate),
    validUntil: dbDateToIso(quote.validUntil),
    subject: quote.subject,
    siteTypeId: quote.siteTypeId,
    introText: quote.introText,
    conditionsText: quote.conditionsText,
    globalDiscountType: globalDiscount.type,
    globalDiscountValue: globalDiscount.value,
    depositType: deposit.type,
    depositValue: deposit.value,
    lines: quote.lines.map((line) => {
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
    }),
  };
}

/**
 * Lecture « tolérante » du formulaire pour afficher les totaux pendant la
 * saisie : une valeur encore invalide compte pour zéro (la validation stricte
 * a lieu à l'enregistrement).
 */
export function previewTotalsInput(
  values: Pick<
    QuoteInput,
    "lines" | "globalDiscountType" | "globalDiscountValue" | "depositType" | "depositValue"
  >,
) {
  const discountOf = (type: DiscountType, value: string) => {
    const parsed = parseDiscountInput(type, value);
    return "discount" in parsed ? parsed.discount : null;
  };
  return {
    lines: values.lines.map((line) => ({
      lineType: line.lineType,
      periodicity: line.lineType === "SUBSCRIPTION" ? line.periodicity : null,
      quantityMilli: parseQuantity(line.quantity) ?? 0,
      unitPriceCents: parseChfInput(line.unitPrice) ?? 0,
      discount: discountOf(line.discountType, line.discountValue),
      vatRateBps: line.vatRateBps,
    })),
    globalDiscount: discountOf(values.globalDiscountType, values.globalDiscountValue),
    deposit: discountOf(values.depositType, values.depositValue),
  };
}
