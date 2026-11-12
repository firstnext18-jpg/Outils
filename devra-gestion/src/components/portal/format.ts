import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { documentLabels } from "@/i18n/documents";
import type { PortalLanguage, PortalTexts } from "@/i18n/portal";

/** Date d'un document (colonne « date » de la base) → « 31.12.2026 ». */
export function documentDate(date: Date): string {
  return formatIsoDate(dbDateToIso(date));
}

/** « Facture », « Facture d'acompte »… dans la langue du client. */
export function invoiceTypeLabel(
  type: "STANDARD" | "DEPOSIT" | "FINAL" | "SUBSCRIPTION",
  language: PortalLanguage,
): string {
  const labels = documentLabels(language);
  if (type === "DEPOSIT") return labels.depositInvoice;
  if (type === "FINAL") return labels.finalInvoice;
  if (type === "SUBSCRIPTION") return labels.subscriptionInvoice;
  return labels.invoice;
}

export function periodicityLabel(
  periodicity: "MONTHLY" | "QUARTERLY" | "YEARLY",
  t: PortalTexts,
): string {
  if (periodicity === "MONTHLY") return t.monthly;
  if (periodicity === "QUARTERLY") return t.quarterly;
  return t.yearly;
}

/** « Libellé : valeur » en français, « Libellé: valeur » en allemand. */
export function labelled(language: PortalLanguage, label: string): string {
  return language === "DE" ? `${label}:` : `${label} :`;
}
