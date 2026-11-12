/**
 * Espace client : chaque client peut recevoir un identifiant et un mot de
 * passe générés par l'outil, pour consulter ses devis, ses factures et ses
 * abonnements, et écrire à l'équipe. Il ne voit jamais les brouillons ni les
 * discussions internes de l'équipe.
 * Module pur : utilisable côté serveur comme côté client.
 */

/** Sans les caractères faciles à confondre (i, l, o, 0, 1). */
const LOGIN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Chaîne aléatoire uniforme (tirage rejeté au-delà du dernier multiple de l'alphabet). */
function randomString(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}

function groups(value: string, size: number): string {
  return (value.match(new RegExp(`.{1,${size}}`, "g")) ?? []).join("-");
}

/** Identifiant de connexion : « k7m3-q9xp » (31⁸ possibilités, unicité vérifiée en base). */
export function generateLogin(): string {
  return groups(randomString(LOGIN_ALPHABET, 8), 4);
}

/** Mot de passe : « Xk7m-Q9xp-3Hnr-Wz4d » (16 caractères tirés parmi 55, ≈ 92 bits). */
export function generatePassword(): string {
  return groups(randomString(PASSWORD_ALPHABET, 16), 4);
}

export const LOGIN_PATTERN = /^[a-z0-9]{4}-[a-z0-9]{4}$/;

/**
 * Identifiant tel que saisi → forme enregistrée : majuscules, espaces ou
 * tiret oublié sont tolérés (« K7M3 Q9XP » → « k7m3-q9xp »).
 */
export function normalizeLogin(input: string): string {
  const compact = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  return compact.length === 8 ? groups(compact, 4) : input.trim().toLowerCase();
}

/** Durée d'une session sans activité, et durée maximale avant de se reconnecter. */
export const PORTAL_SESSION_IDLE_DAYS = 7;
export const PORTAL_SESSION_MAX_DAYS = 30;
/** Validité d'un lien « mot de passe oublié ». */
export const PORTAL_RESET_MINUTES = 60;

/** Devis visibles par le client : tous sauf les brouillons. */
export const PORTAL_QUOTE_STATUSES = ["SENT", "ACCEPTED", "REFUSED", "EXPIRED"] as const;
/** Factures visibles par le client : celles qui ont été émises. */
export const PORTAL_INVOICE_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;

/** Titre de la discussion avec le client, côté équipe. */
export const CLIENT_DISCUSSION_TITLE = "Discussion avec le client";

/** Adresse de l'espace client, à communiquer avec les identifiants. */
export function portalUrl(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/espace-client`;
}
