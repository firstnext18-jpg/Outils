/**
 * Rôles des utilisateurs et règles d'accès.
 * Module pur (sans base de données) : utilisable côté serveur comme côté client.
 */

export const ROLES = ["ADMIN", "MEMBER", "READONLY"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MEMBER: "Membre",
  READONLY: "Lecture seule",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Accès complet, gestion des utilisateurs et des paramètres",
  MEMBER: "Gère clients, devis, factures et catalogue",
  READONLY: "Consulte tout, ne modifie rien",
};

/** Plus le rang est élevé, plus le rôle a de droits. */
const RANK: Record<Role, number> = { READONLY: 0, MEMBER: 1, ADMIN: 2 };

/**
 * Indique si un utilisateur ayant le rôle `userRole` peut effectuer une action
 * qui exige au minimum le rôle `required`.
 *   - "READONLY" : tout utilisateur connecté (consultation)
 *   - "MEMBER"   : membres et admins (modification des données)
 *   - "ADMIN"    : admins uniquement (paramètres, utilisateurs)
 */
export function hasRole(userRole: Role, required: Role): boolean {
  return RANK[userRole] >= RANK[required];
}

/** Peut modifier les données métier (clients, devis, factures…). */
export function canEdit(role: Role): boolean {
  return hasRole(role, "MEMBER");
}

/** Peut accéder aux paramètres et à la gestion des utilisateurs. */
export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}
