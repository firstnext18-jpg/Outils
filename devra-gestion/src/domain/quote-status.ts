/**
 * Statuts d'un devis et changements permis.
 *
 *   brouillon ──► envoyé ──► accepté
 *        ▲          │  └───► refusé
 *        └──────────┘  └───► expiré (automatique à la fin de la validité)
 *
 * Seul un brouillon se modifie ou se supprime : pour corriger un devis envoyé,
 * on le repasse en brouillon.
 */
import type { IsoDate } from "@/domain/dates";

export const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REFUSED", "EXPIRED"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
};

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REFUSED", "DRAFT"],
  ACCEPTED: ["SENT"],
  REFUSED: ["SENT"],
  EXPIRED: ["ACCEPTED", "DRAFT"],
};

/** Libellé du bouton qui provoque le changement de statut. */
export function transitionLabel(from: QuoteStatus, to: QuoteStatus): string {
  if (to === "SENT")
    return from === "DRAFT"
      ? "Marquer comme envoyé"
      : from === "ACCEPTED"
        ? "Annuler l'acceptation"
        : "Annuler le refus";
  if (to === "ACCEPTED") return "Marquer comme accepté";
  if (to === "REFUSED") return "Marquer comme refusé";
  if (to === "DRAFT") return "Repasser en brouillon";
  return QUOTE_STATUS_LABELS[to];
}

export function allowedTransitions(status: QuoteStatus): QuoteStatus[] {
  return TRANSITIONS[status];
}

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isQuoteEditable(status: QuoteStatus): boolean {
  return status === "DRAFT";
}

/** Un devis envoyé dont la date de validité est passée devient « expiré ». */
export function isQuoteExpired(status: QuoteStatus, validUntil: IsoDate, today: IsoDate): boolean {
  return status === "SENT" && validUntil < today;
}
