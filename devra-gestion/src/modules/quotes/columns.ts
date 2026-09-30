import { isoToDbDate } from "@/domain/dates";
import { computeTotals, type DocumentTotals } from "@/domain/totals";
import { UserError } from "@/lib/errors";
import type { QuoteData } from "@/modules/quotes/schemas";

/*
 * Colonnes enregistrées d'un devis (montants recalculés, lignes numérotées),
 * à partir des données validées. Module sans accès à la base : utilisé par le
 * service et par le script de données de démonstration.
 */

/** Les montants sont stockés en entiers 32 bits : environ 21 millions de francs au maximum. */
const MAX_STORED_CENTS = 2_000_000_000;

export function quoteTotals(
  data: Pick<QuoteData, "lines" | "globalDiscount" | "deposit">,
  vatEnabled: boolean,
): DocumentTotals {
  return computeTotals({
    lines: data.lines.map((line) => ({
      lineType: line.lineType,
      periodicity: line.periodicity,
      quantityMilli: line.quantityMilli,
      unitPriceCents: line.unitPriceCents,
      discount: line.discount,
      vatRateBps: line.vatRateBps,
    })),
    globalDiscount: data.globalDiscount,
    deposit: data.deposit,
    vatEnabled,
  });
}

function recurringTotal(totals: DocumentTotals, periodicity: "MONTHLY" | "QUARTERLY" | "YEARLY") {
  return totals.recurring.find((r) => r.periodicity === periodicity)?.totalCents ?? 0;
}

/** Colonnes enregistrées (hors numéro, statut et suivi) à partir des données validées. */
export function quoteColumns(data: QuoteData, vatEnabled: boolean) {
  const totals = quoteTotals(data, vatEnabled);
  const amounts = [
    totals.oneTime.subtotalCents,
    totals.oneTime.totalCents,
    ...totals.recurring.map((r) => r.totalCents),
    ...totals.lines.map((l) => l.grossCents),
  ];
  if (amounts.some((cents) => cents > MAX_STORED_CENTS)) {
    throw new UserError(
      "Montant trop élevé : un devis ne peut pas dépasser 20 millions de francs.",
    );
  }
  return {
    columns: {
      clientId: data.clientId,
      language: data.language,
      issueDate: isoToDbDate(data.issueDate),
      validUntil: isoToDbDate(data.validUntil),
      subject: data.subject,
      siteTypeId: data.siteTypeId,
      introText: data.introText,
      conditionsText: data.conditionsText,
      globalDiscountType: data.globalDiscount?.type ?? null,
      globalDiscountValue: data.globalDiscount?.value ?? 0,
      depositType: data.deposit?.type ?? null,
      depositValue: data.deposit?.value ?? 0,
      vatEnabled,
      subtotalCents: totals.oneTime.subtotalCents,
      discountCents: totals.oneTime.discountCents,
      vatCents: totals.oneTime.vatCents,
      totalCents: totals.oneTime.totalCents,
      depositCents: totals.depositCents,
      recurringMonthlyCents: recurringTotal(totals, "MONTHLY"),
      recurringQuarterlyCents: recurringTotal(totals, "QUARTERLY"),
      recurringYearlyCents: recurringTotal(totals, "YEARLY"),
    },
    lines: data.lines.map((line, position) => ({
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
      netCents: totals.lines[position]!.netCents,
    })),
  };
}
