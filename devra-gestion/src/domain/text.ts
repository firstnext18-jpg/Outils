/**
 * Normalisation pour comparer des libellés saisis librement : minuscules, sans
 * accents, sans ponctuation ni espaces. « Saint-Gall » et « st gall » ne
 * deviennent pas identiques, mais « Genève » et « geneve » oui.
 */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
