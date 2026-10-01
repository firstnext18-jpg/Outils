/**
 * Règles propres aux factures : acompte, facture finale, échéance.
 *
 * Facture d'acompte : son montant est l'acompte prévu au devis (TVA comprise
 * si elle est activée). Avec la TVA, il est réparti entre les taux du devis
 * au prorata, et chaque part est convertie en montant hors TVA pour que la
 * facture affiche la TVA de chaque taux.
 *
 * Facture finale : elle reprend toutes les prestations du devis (TVA sur le
 * montant total), puis déduit les factures d'acompte émises, TVA comprise :
 * « Total − acompte(s) facturé(s) = montant à payer ».
 */
import { addDays, type IsoDate } from "@/domain/dates";
import { divideRounded } from "@/domain/money";
import { allocateProportionally, type SectionTotals } from "@/domain/totals";

/** Part d'une facture d'acompte pour un taux de TVA (null : TVA désactivée). */
export type DepositPart = { vatRateBps: number | null; netCents: number };

export function depositParts(
  oneTime: Pick<SectionTotals, "netCents" | "vat">,
  depositCents: number,
  vatEnabled: boolean,
): DepositPart[] {
  if (depositCents <= 0) return [];
  if (!vatEnabled || oneTime.vat.length === 0) {
    return [{ vatRateBps: vatEnabled ? 0 : null, netCents: depositCents }];
  }
  // Poids de chaque taux : base + TVA ; la part sans TVA (taux 0) en dernier.
  const groups = oneTime.vat.map((v) => ({ rateBps: v.rateBps, gross: v.baseCents + v.vatCents }));
  const untaxed = oneTime.netCents - oneTime.vat.reduce((sum, v) => sum + v.baseCents, 0);
  if (untaxed > 0) groups.push({ rateBps: 0, gross: untaxed });

  const shares = allocateProportionally(
    depositCents,
    groups.map((g) => g.gross),
  );
  return groups
    .map((group, i) => ({
      vatRateBps: group.rateBps,
      // Part TTC → hors TVA : part × 10 000 / (10 000 + taux).
      netCents: divideRounded(BigInt(shares[i]!) * 10_000n, BigInt(10_000 + group.rateBps)),
    }))
    .filter((part) => part.netCents > 0);
}

/** Acompte déjà facturé, déduit sur la facture finale. */
export type Deduction = { invoiceId: string; number: string; amountCents: number };

export function deductedTotal(deductions: Deduction[]): number {
  return deductions.reduce((sum, d) => sum + d.amountCents, 0);
}

/** Échéance par défaut : date de la facture + délai de paiement. */
export function defaultDueDate(issueDate: IsoDate, paymentTermDays: number): IsoDate {
  return addDays(issueDate, paymentTermDays);
}
