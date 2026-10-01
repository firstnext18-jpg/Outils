/**
 * Pourcentages en points de base (entiers) : 10 % → 1000, 8,1 % → 810, 12,5 % → 1250.
 */

export const MAX_PERCENT_BPS = 10_000; // 100 %

/** Lit « 10 », « 8,1 », « 12.5 % » → points de base ; null si invalide ou > 100 %. */
export function parsePercent(input: string): number | null {
  const value = input.trim().replace(/\s*%$/, "").replace(",", ".");
  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return bps <= MAX_PERCENT_BPS ? bps : null;
}

/** Points de base → « 8.1 », « 10 », « 12.5 » (sans le signe %). */
export function formatPercentValue(bps: number): string {
  const units = Math.trunc(bps / 100);
  const rest = bps % 100;
  if (rest === 0) return String(units);
  return `${units}.${String(rest).padStart(2, "0").replace(/0+$/, "")}`;
}

/** Points de base → « 8.1 % » (espace insécable : le signe ne passe jamais à la ligne). */
export function formatPercent(bps: number): string {
  return `${formatPercentValue(bps)}\u00A0%`;
}
