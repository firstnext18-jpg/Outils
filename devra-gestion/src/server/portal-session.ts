import "server-only";
import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_SESSION_IDLE_DAYS, PORTAL_SESSION_MAX_DAYS } from "@/domain/portal";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { requestIp } from "@/server/request-ip";
import { hashToken } from "@/server/tokens";

/**
 * Sessions de l'espace client, séparées de celles de l'équipe (Better Auth) :
 * autre cookie, autre table. Une session client ne peut donc jamais ouvrir
 * l'outil de gestion, et inversement.
 *
 * Le cookie contient un jeton aléatoire de 256 bits ; la base n'en garde que
 * l'empreinte SHA-256. La session expire après 7 jours sans visite, et au plus
 * tard 30 jours après la connexion.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
/** La date d'expiration n'est prolongée qu'une fois par heure (une écriture de moins par page). */
const REFRESH_MS = 60 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function secureCookies() {
  return env().APP_URL.startsWith("https://");
}

/** « __Host- » : cookie limité à ce domaine, en HTTPS, pour tout le site. */
function cookieName() {
  return secureCookies() ? "__Host-espace-client" : "espace-client";
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Ouvre une session pour ce compte et pose le cookie (actions serveur uniquement). */
export async function openPortalSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await db.clientSession.create({
    data: {
      accountId,
      tokenHash: hashToken(token),
      expiresAt: new Date(now + PORTAL_SESSION_IDLE_DAYS * DAY_MS),
      ipAddress: await requestIp(),
      userAgent: ((await headers()).get("user-agent") ?? "").slice(0, 300),
    },
  });
  (await cookies()).set(cookieName(), token, cookieOptions(PORTAL_SESSION_MAX_DAYS * 24 * 3600));
}

export type PortalSession = {
  sessionId: string;
  account: { id: string; login: string };
  client: {
    id: string;
    displayName: string;
    kind: "INDIVIDUAL" | "COMPANY";
    firstName: string;
    lastName: string;
    contactName: string;
    email: string;
    language: "FR" | "DE";
  };
};

/**
 * Session du client pour la requête en cours, ou `null` (pas de cookie,
 * session expirée, accès désactivé). Relue en base à chaque requête : une
 * désactivation par l'équipe s'applique immédiatement.
 */
export const getPortalSession = cache(async (): Promise<PortalSession | null> => {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const session = await db.clientSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      account: {
        select: {
          id: true,
          login: true,
          active: true,
          client: {
            select: {
              id: true,
              displayName: true,
              kind: true,
              firstName: true,
              lastName: true,
              contactName: true,
              email: true,
              language: true,
            },
          },
        },
      },
    },
  });
  const now = Date.now();
  if (
    !session ||
    !session.account.active ||
    session.expiresAt.getTime() <= now ||
    session.createdAt.getTime() + PORTAL_SESSION_MAX_DAYS * DAY_MS <= now
  ) {
    return null;
  }
  if (now - session.lastSeenAt.getTime() > REFRESH_MS) {
    await db.clientSession.update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date(now),
        expiresAt: new Date(now + PORTAL_SESSION_IDLE_DAYS * DAY_MS),
      },
    });
  }
  const { client, id, login } = session.account;
  return { sessionId: session.id, account: { id, login }, client };
});

/** Exige un client connecté (sinon : page de connexion de l'espace client). */
export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) redirect("/espace-client/connexion");
  return session;
}

/** Ferme la session en cours et efface le cookie (actions serveur uniquement). */
export async function closePortalSession() {
  const store = await cookies();
  const token = store.get(cookieName())?.value;
  if (token && TOKEN_PATTERN.test(token)) {
    await db.clientSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.set(cookieName(), "", cookieOptions(0));
}
