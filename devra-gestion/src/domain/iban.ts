/**
 * Validation des IBAN et QR-IBAN suisses.
 *
 * La QR-facture n'accepte que des comptes suisses ou liechtensteinois (CH / LI,
 * 21 caractères). Un QR-IBAN se reconnaît à son identifiant d'institution
 * (IID, positions 5 à 9) compris entre 30000 et 31999 ; il s'utilise avec une
 * référence QRR, alors qu'un IBAN classique s'utilise avec une référence SCOR
 * ou sans référence.
 */

/** Supprime les espaces et met en majuscules. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/**
 * Vérifie la clé de contrôle ISO 13616 (modulo 97) d'un IBAN normalisé :
 * on déplace les 4 premiers caractères à la fin, on remplace chaque lettre par
 * un nombre (A = 10 … Z = 35) et le reste de la division par 97 doit valoir 1.
 */
export function hasValidIbanChecksum(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  return mod97(iban.slice(4) + iban.slice(0, 4)) === 1;
}

/**
 * Reste de la division par 97 d'une chaîne de chiffres et de lettres
 * majuscules, chaque lettre valant un nombre (A = 10 … Z = 35). Utilisé par
 * les IBAN (ISO 13616) et les références créancier SCOR (ISO 11649).
 */
export function mod97(alphanumeric: string): number {
  let remainder = 0;
  for (const char of alphanumeric) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    // Calcul par morceaux : le nombre complet dépasserait la précision des nombres JS.
    for (const digit of digits) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder;
}

/** IBAN suisse ou liechtensteinois valide (format et clé de contrôle). */
export function isValidSwissIban(value: string): boolean {
  const iban = normalizeIban(value);
  return /^(CH|LI)\d{7}[A-Z0-9]{12}$/.test(iban) && hasValidIbanChecksum(iban);
}

/** Identifiant d'institution (IID) d'un IBAN suisse : positions 5 à 9. */
function institutionId(iban: string): number {
  return Number(iban.slice(4, 9));
}

/** QR-IBAN : IBAN suisse valide dont l'IID est compris entre 30000 et 31999. */
export function isQrIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!isValidSwissIban(iban)) return false;
  const iid = institutionId(iban);
  return iid >= 30000 && iid <= 31999;
}

/** Affichage par groupes de 4 : « CH93 0076 2011 6238 5295 7 ». */
export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})(?=.)/g, "$1 ");
}
