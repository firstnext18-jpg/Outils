import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { hasRole, type Role } from "@/domain/roles";
import { getCurrentUser, type CurrentUser } from "@/server/session";

/** Résultat renvoyé au navigateur par toutes les actions serveur. */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/**
 * Erreur « métier » dont le message peut être montré tel quel à l'utilisateur
 * (ex. « Un utilisateur avec cet email existe déjà. »).
 */
export class UserError extends Error {}

const GENERIC_ERROR =
  "Une erreur inattendue est survenue. Réessayez ou contactez un administrateur.";

/**
 * Point d'entrée unique de toutes les actions serveur authentifiées :
 *   session → rôle → validation Zod → traitement.
 * On ne peut pas déclarer d'action sans indiquer le rôle minimum requis.
 *
 * @example
 *   export const inviteUser = authAction({ role: "ADMIN", schema }, async (input, { user }) => { … });
 */
export function authAction<S extends z.ZodType, R>(
  config: { role: Role; schema: S },
  handler: (input: z.output<S>, ctx: { user: CurrentUser }) => Promise<R>,
): (input: z.input<S>) => Promise<ActionResult<R>> {
  return async (input) => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Votre session a expiré. Reconnectez-vous." };
    if (!hasRole(user.role, config.role)) {
      return { ok: false, error: "Vous n'avez pas les droits nécessaires pour cette action." };
    }
    return run(config.schema, input, (data) => handler(data, { user }));
  };
}

/**
 * Action serveur accessible sans être connecté (ex. accepter une invitation).
 * La validation Zod reste obligatoire.
 */
export function publicAction<S extends z.ZodType, R>(
  config: { schema: S },
  handler: (input: z.output<S>) => Promise<R>,
): (input: z.input<S>) => Promise<ActionResult<R>> {
  return async (input) => run(config.schema, input, handler);
}

/**
 * Regroupe les erreurs Zod par champ. Les champs imbriqués sont notés avec des
 * points (« client.lastName ») pour pouvoir être affichés sous le bon champ.
 */
function collectErrors(error: z.ZodError) {
  const formErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    if (issue.path.length === 0) formErrors.push(issue.message);
    else (fieldErrors[issue.path.join(".")] ??= []).push(issue.message);
  }
  return { formErrors, fieldErrors };
}

async function run<S extends z.ZodType, R>(
  schema: S,
  input: unknown,
  handler: (input: z.output<S>) => Promise<R>,
): Promise<ActionResult<R>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = collectErrors(parsed.error);
    return {
      ok: false,
      error: formErrors[0] ?? "Certaines informations sont invalides.",
      fieldErrors,
    };
  }
  try {
    return { ok: true, data: await handler(parsed.data) };
  } catch (error) {
    // Laisse passer redirect(), notFound()… utilisés volontairement.
    unstable_rethrow(error);
    if (error instanceof UserError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: GENERIC_ERROR };
  }
}
