import { hash, verify } from "@node-rs/argon2";

/**
 * Hachage des mots de passe en Argon2id (paramètres recommandés par l'OWASP :
 * 19 Mio de mémoire, 2 itérations). Le binaire natif est précompilé pour ARM64,
 * donc compatible Raspberry Pi sans compilation.
 */
// Argon2id est l'algorithme par défaut de @node-rs/argon2.
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Empreinte illisible (format inattendu) : on refuse plutôt que de planter.
    return false;
  }
}
