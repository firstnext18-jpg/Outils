/**
 * État des clients : un état choisi par l'équipe (liste modifiable dans
 * Paramètres → Listes), plus des indicateurs calculés d'après les documents,
 * toujours à jour sans rien saisir.
 * Module pur : utilisable côté serveur comme côté client.
 */

export const CLIENT_INDICATORS = {
  "devis-a-accepter": "Devis à accepter",
  "facture-a-envoyer": "Facture à envoyer",
  "facture-en-retard": "Facture en retard",
} as const;
export type ClientIndicator = keyof typeof CLIENT_INDICATORS;

/** Filtre « sans état » de la liste des clients. */
export const NO_STAGE_FILTER = "aucun";

export type ClientIndicatorCounts = {
  /** Devis envoyés, en attente de réponse. */
  sentQuotes: number;
  /** Brouillons de facture, et devis acceptés pas encore facturés. */
  toInvoice: number;
  /** Factures dont l'échéance est dépassée. */
  overdueInvoices: number;
};

export function clientIndicators(counts: ClientIndicatorCounts): ClientIndicator[] {
  const indicators: ClientIndicator[] = [];
  if (counts.sentQuotes > 0) indicators.push("devis-a-accepter");
  if (counts.toInvoice > 0) indicators.push("facture-a-envoyer");
  if (counts.overdueInvoices > 0) indicators.push("facture-en-retard");
  return indicators;
}
