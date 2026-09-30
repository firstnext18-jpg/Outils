/**
 * Montants : toujours des entiers en centimes (jamais de nombres à virgule),
 * pour éviter les erreurs d'arrondi.
 */

/** Plafond d'un prix unitaire saisi : 10 millions de francs. */
export const MAX_UNIT_PRICE_CENTS = 1_000_000_000;

/**
 * Lit un montant saisi par un utilisateur et le convertit en centimes.
 *   « 1'490.00 », « 1 490,50 », « CHF 90 », « 1.250,5 » (format allemand), « 0.05 »
 * Renvoie null si la saisie n'est pas un montant valable (plus de deux
 * décimales, lettres, montant négatif…).
 */
export function parseChfInput(input: string): number | null {
  let value = input
    .trim()
    .replace(/^CHF\s*/i, "")
    .replace(/\s*CHF$/i, "");
  // Séparateurs de milliers : apostrophes (droite ou typographique) et espaces.
  value = value.replace(/['’\s  ]/g, "");
  if (!value) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Les deux sont présents : le dernier est le séparateur décimal.
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    value = value.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    // « 1,250 » (virgule suivie de 3 chiffres) : séparateur de milliers ; sinon décimal.
    value = /^\d{1,3}(,\d{3})+$/.test(value) ? value.replaceAll(",", "") : value.replace(",", ".");
  }

  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const francs = Number(match[1]);
  const centimes = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = francs * 100 + centimes;
  return Number.isSafeInteger(cents) ? cents : null;
}
