import type { Role } from "@/domain/roles";
import type { db, Tx } from "@/server/db";
import { hashPassword } from "@/server/password";

/**
 * Crée un utilisateur avec son compte « email + mot de passe », au format
 * attendu par Better Auth (providerId = "credential"). Utilisé par
 * l'acceptation d'une invitation et par le seed du premier admin.
 */
export async function createUserWithPassword(
  client: Tx | typeof db,
  input: { name: string; email: string; role: Role; password: string },
) {
  const passwordHash = await hashPassword(input.password);
  const user = await client.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role,
      // L'adresse est vérifiée : le compte a été activé via un lien reçu par email
      // (ou créé par l'administrateur du serveur pour le seed).
      emailVerified: true,
    },
  });
  await client.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: passwordHash,
    },
  });
  return user;
}
