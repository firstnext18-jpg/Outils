/**
 * Dépenses de l'entreprise. Montant payé TVA comprise ; la TVA qu'il
 * contient (impôt préalable) se déduit du taux choisi.
 * Module pur : utilisable côté serveur comme côté client.
 */
import { divideRounded } from "@/domain/money";

/** TVA contenue dans un montant TTC : 108.10 à 8.1 % → 8.10. */
export function vatIncluded(amountCents: number, rateBps: number | null): number {
  if (!rateBps || rateBps <= 0) return 0;
  return divideRounded(BigInt(amountCents) * BigInt(rateBps), BigInt(10_000 + rateBps));
}
