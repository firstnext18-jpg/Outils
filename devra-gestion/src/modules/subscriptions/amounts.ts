import { PERIODICITY_UNIT, type PeriodicityCode } from "@/domain/catalog";
import { computeTotals } from "@/domain/totals";
import { discountToInput, storedDiscount, type DocumentLineInput } from "@/modules/documents/lines";
import { formatQuantity } from "@/domain/quantity";
import { formatAmount } from "@/lib/format";

type Item = {
  catalogItemId: string | null;
  label: string;
  description: string;
  quantityMilli: number;
  unitPriceCents: number;
  discountType: "PERCENT" | "AMOUNT" | null;
  discountValue: number;
  vatRateBps: number | null;
};

/** Montant d'une période, hors TVA, arrondi aux 5 centimes (revenu récurrent, listes). */
export function periodAmount(items: Omit<Item, "catalogItemId" | "label" | "description">[]) {
  return computeTotals({
    lines: items.map((item) => ({
      lineType: "SUBSCRIPTION",
      periodicity: "MONTHLY",
      quantityMilli: item.quantityMilli,
      unitPriceCents: item.unitPriceCents,
      discount: storedDiscount(item.discountType, item.discountValue),
      vatRateBps: null,
    })),
    globalDiscount: null,
    deposit: null,
    vatEnabled: false,
    separateRecurring: false,
  }).oneTime.totalCents;
}

/** Prestation d'abonnement → ligne de facture (période facturée). */
export function itemToInvoiceLine(
  item: Item,
  periodicity: PeriodicityCode,
  vatRateBps: number | null,
): DocumentLineInput {
  const discount = discountToInput(item.discountType, item.discountValue);
  return {
    catalogItemId: item.catalogItemId,
    lineType: "SUBSCRIPTION",
    periodicity,
    label: item.label,
    description: item.description,
    quantity: formatQuantity(item.quantityMilli),
    unit: PERIODICITY_UNIT[periodicity],
    unitPrice: formatAmount(item.unitPriceCents),
    discountType: discount.type,
    discountValue: discount.value,
    vatRateBps,
  };
}
