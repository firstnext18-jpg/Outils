/**
 * Calcul des montants d'un devis ou d'une facture.
 *
 * Tous les montants sont des centimes entiers ; les multiplications passent
 * par BigInt (voir divideRounded) pour rester exactes.
 *
 * Ordre des calculs :
 *   1. Chaque ligne : brut = quantité × prix unitaire (arrondi au centime),
 *      puis remise de ligne (% ou CHF, jamais plus que le brut) → net.
 *   2. Les lignes sont séparées en « montant unique » et en montants récurrents
 *      (abonnements), regroupés par périodicité.
 *   3. Montant unique : remise globale (% ou CHF, cumulable avec les remises de
 *      ligne) → base hors TVA. Les abonnements ne reçoivent pas la remise
 *      globale.
 *   4. TVA (si activée) : calculée par taux, sur la base après remise globale
 *      (la remise est répartie entre les taux au prorata).
 *   5. Total arrondi aux 5 centimes (règle suisse) ; l'écart est la ligne
 *      « Arrondi ».
 *   6. Acompte : % ou CHF du total unique, arrondi aux 5 centimes.
 */
import type { LineTypeCode, PeriodicityCode } from "@/domain/catalog";
import { PERIODICITIES } from "@/domain/catalog";
import { divideRounded, roundTo5Cents } from "@/domain/money";
import { MAX_PERCENT_BPS } from "@/domain/percent";

export type DiscountType = "PERCENT" | "AMOUNT";

/** Remise ou acompte : valeur en points de base (PERCENT) ou en centimes (AMOUNT). */
export type Discount = { type: DiscountType; value: number } | null;

export type CalcLine = {
  lineType: LineTypeCode;
  periodicity: PeriodicityCode | null;
  quantityMilli: number;
  unitPriceCents: number;
  discount: Discount;
  /** Taux de TVA de la ligne (points de base) ; ignoré si la TVA est désactivée. */
  vatRateBps: number | null;
};

export type LineAmounts = { grossCents: number; discountCents: number; netCents: number };

export type VatAmount = { rateBps: number; baseCents: number; vatCents: number };

export type SectionTotals = {
  /** Somme des lignes nettes. */
  subtotalCents: number;
  /** Remise globale (toujours 0 pour les montants récurrents). */
  discountCents: number;
  /** Base hors TVA : sous-total moins la remise globale. */
  netCents: number;
  /** Détail de la TVA par taux (vide si la TVA est désactivée). */
  vat: VatAmount[];
  vatCents: number;
  /** Écart dû à l'arrondi aux 5 centimes (positif ou négatif, au plus 2 centimes). */
  roundingCents: number;
  /** Montant à payer, arrondi aux 5 centimes. */
  totalCents: number;
};

export type RecurringTotals = SectionTotals & { periodicity: PeriodicityCode };

export type DocumentTotals = {
  lines: LineAmounts[];
  oneTime: SectionTotals;
  /** Un groupe par périodicité présente (mensuel, trimestriel, annuel). */
  recurring: RecurringTotals[];
  /** Acompte demandé (0 si aucun). */
  depositCents: number;
};

/** Montant d'une remise appliquée à `base` (jamais négatif, jamais plus que la base). */
export function discountAmount(base: number, discount: Discount): number {
  if (!discount || discount.value <= 0 || base <= 0) return 0;
  if (discount.type === "PERCENT") {
    const bps = Math.min(discount.value, MAX_PERCENT_BPS);
    return divideRounded(BigInt(base) * BigInt(bps), 10_000n);
  }
  return Math.min(discount.value, base);
}

/** Montants d'une ligne : brut, remise de ligne, net. */
export function computeLine(
  line: Pick<CalcLine, "quantityMilli" | "unitPriceCents" | "discount">,
): LineAmounts {
  const grossCents = divideRounded(BigInt(line.quantityMilli) * BigInt(line.unitPriceCents), 1000n);
  const discountCents = discountAmount(grossCents, line.discount);
  return { grossCents, discountCents, netCents: grossCents - discountCents };
}

/**
 * Répartit `amount` entre des parts proportionnelles à `weights`, en centimes
 * entiers, sans perte : la somme des parts vaut exactement `amount` (méthode
 * du plus fort reste).
 */
export function allocateProportionally(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0 || amount === 0) return weights.map(() => 0);
  const exact = weights.map((w) => (BigInt(amount) * BigInt(w)) % BigInt(total));
  const shares = weights.map((w) => Number((BigInt(amount) * BigInt(w)) / BigInt(total)));
  let remainder = amount - shares.reduce((sum, s) => sum + s, 0);
  const order = exact
    .map((rest, index) => ({ rest, index }))
    .sort((a, b) => (a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1));
  for (const { index } of order) {
    if (remainder <= 0) break;
    shares[index]! += 1;
    remainder -= 1;
  }
  return shares;
}

function computeSection(
  lines: { netCents: number; vatRateBps: number | null }[],
  globalDiscount: Discount,
  vatEnabled: boolean,
): SectionTotals {
  const subtotalCents = lines.reduce((sum, line) => sum + line.netCents, 0);
  const discountCents = discountAmount(subtotalCents, globalDiscount);
  const netCents = subtotalCents - discountCents;

  const vat: VatAmount[] = [];
  if (vatEnabled && netCents > 0) {
    // Bases par taux, avant remise globale…
    const byRate = new Map<number, number>();
    for (const line of lines) {
      const rate = line.vatRateBps ?? 0;
      byRate.set(rate, (byRate.get(rate) ?? 0) + line.netCents);
    }
    const rates = [...byRate.keys()].sort((a, b) => b - a);
    // …puis remise globale répartie entre les taux au prorata.
    const discounts = allocateProportionally(
      discountCents,
      rates.map((r) => byRate.get(r)!),
    );
    rates.forEach((rateBps, i) => {
      const baseCents = byRate.get(rateBps)! - discounts[i]!;
      if (rateBps > 0) {
        vat.push({
          rateBps,
          baseCents,
          vatCents: divideRounded(BigInt(baseCents) * BigInt(rateBps), 10_000n),
        });
      }
    });
  }
  const vatCents = vat.reduce((sum, v) => sum + v.vatCents, 0);
  const exactTotal = netCents + vatCents;
  const totalCents = roundTo5Cents(exactTotal);
  return {
    subtotalCents,
    discountCents,
    netCents,
    vat,
    vatCents,
    roundingCents: totalCents - exactTotal,
    totalCents,
  };
}

/** Acompte : % ou CHF du total unique, arrondi aux 5 centimes, jamais plus que le total. */
export function depositAmount(oneTimeTotalCents: number, deposit: Discount): number {
  if (!deposit || deposit.value <= 0 || oneTimeTotalCents <= 0) return 0;
  const raw =
    deposit.type === "PERCENT"
      ? divideRounded(
          BigInt(oneTimeTotalCents) * BigInt(Math.min(deposit.value, MAX_PERCENT_BPS)),
          10_000n,
        )
      : Math.min(deposit.value, oneTimeTotalCents);
  return Math.min(roundTo5Cents(raw), oneTimeTotalCents);
}

export function computeTotals(input: {
  lines: CalcLine[];
  globalDiscount: Discount;
  deposit: Discount;
  vatEnabled: boolean;
}): DocumentTotals {
  const lines = input.lines.map(computeLine);
  const withAmounts = input.lines.map((line, i) => ({ ...line, netCents: lines[i]!.netCents }));

  const oneTime = computeSection(
    withAmounts.filter((line) => line.lineType !== "SUBSCRIPTION"),
    input.globalDiscount,
    input.vatEnabled,
  );

  const recurring: RecurringTotals[] = [];
  for (const periodicity of PERIODICITIES) {
    const group = withAmounts.filter(
      (line) => line.lineType === "SUBSCRIPTION" && (line.periodicity ?? "MONTHLY") === periodicity,
    );
    if (group.length > 0) {
      recurring.push({ periodicity, ...computeSection(group, null, input.vatEnabled) });
    }
  }

  return {
    lines,
    oneTime,
    recurring,
    depositCents: depositAmount(oneTime.totalCents, input.deposit),
  };
}
