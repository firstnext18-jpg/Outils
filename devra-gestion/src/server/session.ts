import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasRole, type Role } from "@/domain/roles";
import { getAuth } from "@/server/auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/**
 * Utilisateur connecté pour la requête en cours, ou `null`.
 * La session est relue en base à chaque requête : un changement de rôle ou une
 * désactivation s'applique immédiatement.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || !session.user.active) return null;
  const { id, name, email, role } = session.user;
  return { id, name, email, role: role as Role };
});

/** Exige un utilisateur connecté (sinon : page de connexion). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

/**
 * Exige un rôle minimum pour afficher une page. À appeler dans chaque page
 * protégée (et pas seulement dans le layout, qui n'est pas réexécuté à chaque
 * navigation).
 */
export async function requireRole(required: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user.role, required)) redirect("/acces-refuse");
  return user;
}
