import type { DiscountType, Discount } from "@/domain/totals";
import { computeTotals } from "@/domain/totals";

type StoredLine = {
  lineType: "FLAT" | "HOURLY" | "EXTRA" | "SUBSCRIPTION";
  periodicity: "MONTHLY" | "QUARTERLY" | "YEARLY" | null;
  quantityMilli: number;
  unitPriceCents: number;
  discountType: DiscountType | null;
  discountValue: number;
  vatRateBps: number | null;
};

export function storedDiscount(type: DiscountType | null, value: number): Discount {
  return type && value > 0 ? { type, value } : null;
}

/** Totaux d'un document enregistré (mêmes calculs qu'à l'enregistrement). */
export function storedDocumentTotals(doc: {
  lines: StoredLine[];
  globalDiscountType: DiscountType | null;
  globalDiscountValue: number;
  depositType: DiscountType | null;
  depositValue: number;
  vatEnabled: boolean;
}) {
  const globalDiscount = storedDiscount(doc.globalDiscountType, doc.globalDiscountValue);
  const deposit = storedDiscount(doc.depositType, doc.depositValue);
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
  });
  return { totals, globalDiscount, deposit };
}
