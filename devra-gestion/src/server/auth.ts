import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { sendPasswordResetEmail } from "@/server/emails/auth-emails";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/modules/users/schemas";
import { hashPassword, verifyPassword } from "@/server/password";

/**
 * Configuration de Better Auth : email + mot de passe uniquement, pas
 * d'inscription libre (les comptes sont créés par invitation d'un admin).
 */
function createAuth() {
  const e = env();
  return betterAuth({
    appName: "Gestion",
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.APP_URL],
    database: prismaAdapter(db, { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
      resetPasswordTokenExpiresIn: 60 * 60,
      // Après une réinitialisation, toutes les sessions ouvertes sont fermées.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        // Pas d'email pour un compte désactivé.
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { active: true },
        });
        if (!dbUser?.active) return;
        await sendPasswordResetEmail(user, url);
      },
    },

    user: {
      additionalFields: {
        // `input: false` : ces champs ne peuvent pas être modifiés via l'API
        // d'authentification, seulement par un admin via l'application.
        role: {
          type: ["ADMIN", "MEMBER", "READONLY"],
          required: true,
          defaultValue: "MEMBER",
          input: false,
        },
        active: { type: "boolean", required: true, defaultValue: true, input: false },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 jours…
      updateAge: 60 * 60 * 24, // …prolongés à chaque jour d'utilisation
    },

    // Protection contre la force brute : compteurs stockés en base (conservés
    // après un redémarrage), par adresse IP.
    rateLimit: {
      enabled: e.AUTH_RATE_LIMIT,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/reset-password": { window: 60, max: 5 },
      },
    },

    advanced: {
      // Les identifiants sont générés par la base (UUID v7, voir schema.prisma).
      database: { generateId: false },
      // En-tête fourni par le reverse proxy (Cloudflare Tunnel ou Caddy).
      ipAddress: { ipAddressHeaders: [e.AUTH_IP_HEADER] },
      useSecureCookies: e.APP_URL.startsWith("https://"),
    },

    databaseHooks: {
      session: {
        create: {
          // Refuse l'ouverture d'une session pour un compte désactivé.
          before: async (session) => {
            const user = await db.user.findUnique({
              where: { id: session.userId },
              select: { active: true },
            });
            if (!user?.active) return false;
          },
        },
      },
    },

    // Permet aux actions serveur de poser les cookies de session.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { auth?: Auth };

/** Instance Better Auth, créée au premier appel (les secrets ne sont pas lus au build). */
export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
