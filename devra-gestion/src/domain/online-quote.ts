/**
 * Acceptation des devis en ligne.
 *
 * Le client reçoit un lien secret (jeton aléatoire de 256 bits ; seule son
 * empreinte SHA-256 est enregistrée). Il peut accepter ou refuser le devis
 * tant qu'il est « envoyé » et que sa date de validité n'est pas dépassée.
 * Le lien reste consultable 30 jours de plus (pour revoir sa décision ou le
 * PDF), puis expire.
 */
import { z } from "zod";
import { addDays, zurichMidnight, type IsoDate } from "@/domain/dates";

/** Jours pendant lesquels le lien reste consultable après la fin de validité du devis. */
export const LINK_GRACE_DAYS = 30;

/** Expiration d'un lien : minuit (Zurich) à la fin du délai de grâce. */
export function linkExpiry(validUntil: IsoDate): Date {
  return zurichMidnight(addDays(validUntil, LINK_GRACE_DAYS + 1));
}

export type OnlineQuoteState =
  /** Le client peut accepter ou refuser. */
  | "open"
  | "accepted"
  | "refused"
  /** Validité dépassée (ou devis marqué expiré). */
  | "expired"
  /** Repassé en brouillon : en cours de modification. */
  | "unavailable";

export function onlineQuoteState(
  quote: { status: string; validUntil: IsoDate },
  today: IsoDate,
): OnlineQuoteState {
  switch (quote.status) {
    case "ACCEPTED":
      return "accepted";
    case "REFUSED":
      return "refused";
    case "EXPIRED":
      return "expired";
    case "SENT":
      return quote.validUntil < today ? "expired" : "open";
    default:
      return "unavailable";
  }
}

const name = z
  .string()
  .trim()
  .min(2, "Indiquez votre nom et prénom")
  .max(120, "120 caractères maximum");

/** Jeton du lien : 43 caractères base64url (32 octets). */
export const onlineTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Lien invalide");

export const onlineAcceptSchema = z.object({
  token: onlineTokenSchema,
  name,
  accept: z.literal(true, { error: "Cochez la case pour accepter le devis" }),
});

export const onlineRefuseSchema = z.object({
  token: onlineTokenSchema,
  name,
  comment: z.string().trim().max(1000, "1000 caractères maximum"),
});
