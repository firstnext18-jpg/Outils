import { createHash, randomBytes } from "node:crypto";

/**
 * Jetons à usage unique (invitations, puis liens d'acceptation de devis).
 * Le jeton (32 octets aléatoires, non devinable) n'est envoyé qu'une fois par
 * email ; la base ne stocke que son empreinte SHA-256.
 */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
