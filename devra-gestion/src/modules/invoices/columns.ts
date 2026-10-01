import { isoToDbDate } from "@/domain/dates";
import { deductedTotal, type Deduction } from "@/domain/invoices";
import { computeTotals } from "@/domain/totals";
import { UserError } from "@/lib/errors";
import { lineRows, MAX_STORED_CENTS } from "@/modules/documents/lines";
import type { InvoiceData } from "@/modules/invoices/schemas";

/*
 * Colonnes enregistrées d'une facture (montants recalculés, lignes numérotées).
 * Module sans accès à la base : utilisé par le service et les données de démonstration.
 */

export function invoiceTotals(
  data: Pick<InvoiceData, "lines" | "globalDiscount">,
  vatEnabled: boolean,
) {
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
    deposit: null,
    vatEnabled,
    // Sur une facture, tout est dû, y compris une période d'abonnement.
    separateRecurring: false,
  });
}

export function invoiceColumns(data: InvoiceData, vatEnabled: boolean, deductions: Deduction[]) {
  const totals = invoiceTotals(data, vatEnabled);
  const total = totals.oneTime.totalCents;
  if ([total, ...totals.lines.map((l) => l.grossCents)].some((c) => c > MAX_STORED_CENTS)) {
    throw new UserError(
      "Montant trop élevé : une facture ne peut pas dépasser 20 millions de francs.",
    );
  }
  const deducted = deductedTotal(deductions);
  if (deducted > total) {
    throw new UserError(
      "Les acomptes déduits dépassent le total de la facture : vérifiez les lignes.",
    );
  }
  return {
    columns: {
      clientId: data.clientId,
      language: data.language,
      issueDate: isoToDbDate(data.issueDate),
      dueDate: isoToDbDate(data.dueDate),
      subject: data.subject,
      siteTypeId: data.siteTypeId,
      introText: data.introText,
      conditionsText: data.conditionsText,
      globalDiscountType: data.globalDiscount?.type ?? null,
      globalDiscountValue: data.globalDiscount?.value ?? 0,
      vatEnabled,
      subtotalCents: totals.oneTime.subtotalCents,
      discountCents: totals.oneTime.discountCents,
      vatCents: totals.oneTime.vatCents,
      totalCents: total,
      deductions: deductions.length > 0 ? deductions : undefined,
      deductedCents: deducted,
      amountDueCents: total - deducted,
    },
    lines: lineRows(
      data.lines,
      totals.lines.map((line) => line.netCents),
      vatEnabled,
    ),
  };
}
