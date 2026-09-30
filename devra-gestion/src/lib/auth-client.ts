import { createAuthClient } from "better-auth/react";

/**
 * Client d'authentification côté navigateur. La connexion passe par l'API HTTP
 * de Better Auth (et donc par la limitation des tentatives).
 */
export const authClient = createAuthClient();
