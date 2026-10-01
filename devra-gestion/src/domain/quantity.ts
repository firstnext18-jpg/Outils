/**
 * Quantités en millièmes (entiers) : 1 → 1000, 1,5 h → 1500, 0,25 h → 250.
 */

export const MAX_QUANTITY_MILLI = 100_000_000; // 100 000 unités

/** Lit « 1,5 », « 1.5 », « 2 » → millièmes ; null si invalide (plus de 3 décimales, négatif…). */
export function parseQuantity(input: string): number | null {
  const value = input
    .trim()
    .replace(/['’\s]/g, "")
    .replace(",", ".");
  const match = value.match(/^(\d+)(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const milli = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  return Number.isSafeInteger(milli) ? milli : null;
}

/** Millièmes → « 1.5 », « 2 », « 0.25 » (sans zéros inutiles). */
export function formatQuantity(milli: number): string {
  const units = Math.trunc(milli / 1000);
  const rest = Math.abs(milli % 1000);
  if (rest === 0) return String(units);
  return `${units}.${String(rest).padStart(3, "0").replace(/0+$/, "")}`;
}
