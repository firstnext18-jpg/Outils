/**
 * Numérotation des documents : « D-2026-001 », « F-2026-014 ».
 *
 * Le format est configurable dans les Paramètres, avec des jetons :
 *   {AAAA} année sur 4 chiffres · {AA} année sur 2 chiffres ·
 *   {NNN} numéro dans l'année, complété par des zéros (autant de N que de chiffres).
 * Le compteur repart à 1 chaque année : le format doit donc contenir l'année,
 * sinon deux documents de deux années différentes auraient le même numéro.
 */

export const DEFAULT_QUOTE_NUMBER_FORMAT = "D-{AAAA}-{NNN}";
export const DEFAULT_INVOICE_NUMBER_FORMAT = "F-{AAAA}-{NNN}";

const TOKEN = /\{([A-Z]+)\}/g;

export function formatDocumentNumber(format: string, year: number, sequence: number): string {
  return format.replace(TOKEN, (token, name: string) => {
    if (name === "AAAA") return String(year);
    if (name === "AA") return String(year % 100).padStart(2, "0");
    if (/^N+$/.test(name)) return String(sequence).padStart(name.length, "0");
    return token;
  });
}

/** Message d'erreur si le format est invalide, sinon null. */
export function validateNumberFormat(format: string): string | null {
  if (!format || format.length > 30) return "Le format doit faire entre 1 et 30 caractères.";
  const tokens = [...format.matchAll(TOKEN)].map((m) => m[1]!);
  const unknown = tokens.find((t) => t !== "AAAA" && t !== "AA" && !/^N{1,6}$/.test(t));
  if (unknown) return `Jeton inconnu : {${unknown}}. Jetons possibles : {AAAA}, {AA}, {NNN}.`;
  const counters = tokens.filter((t) => t.startsWith("N"));
  if (counters.length !== 1)
    return "Le format doit contenir un et un seul compteur, par ex. {NNN}.";
  if (!tokens.some((t) => t === "AAAA" || t === "AA")) {
    return "Le format doit contenir l'année ({AAAA} ou {AA}) : le compteur repart à 1 chaque année.";
  }
  if (!/^[A-Za-z0-9\-_/.]*$/.test(format.replace(TOKEN, ""))) {
    return "Seuls les lettres, chiffres et les caractères - _ / . sont permis.";
  }
  return null;
}
