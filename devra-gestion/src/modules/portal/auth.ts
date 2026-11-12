import "server-only";
import { normalizeLogin, PORTAL_RESET_MINUTES, portalUrl } from "@/domain/portal";
import { logActivity } from "@/server/activity";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { sendPortalResetEmail } from "@/server/emails/portal-emails";
import { hashPassword, verifyPassword } from "@/server/password";
import { closePortalSession, openPortalSession, type PortalSession } from "@/server/portal-session";
import { allowAttempt } from "@/server/rate-limit";
import { generateToken, hashToken } from "@/server/tokens";

/**
 * Connexion à l'espace client et mot de passe (changement, oubli).
 * Les tentatives sont limitées par adresse IP ; les réponses ne révèlent
 * jamais si un identifiant ou une adresse email existe.
 */

const LOGIN_RULE = { windowSeconds: 300, max: 10 };
const FORGOT_RULE = { windowSeconds: 300, max: 3 };
const RESET_RULE = { windowSeconds: 60, max: 5 };
const CHANGE_RULE = { windowSeconds: 300, max: 5 };

/**
 * Empreinte vérifiée quand l'identifiant est inconnu : la réponse prend le
 * même temps qu'avec un identifiant existant.
 */
let dummyHash: Promise<string> | undefined;
function decoyHash() {
  dummyHash ??= hashPassword(crypto.randomUUID());
  return dummyHash;
}

export type SignInResult = "ok" | "invalid" | "disabled" | "limited";

export async function signIn(
  loginInput: string,
  password: string,
  ip: string,
): Promise<SignInResult> {
  if (!(await allowAttempt(`espace-client:connexion:${ip}`, LOGIN_RULE))) return "limited";
  const account = await db.clientAccount.findUnique({
    where: { login: normalizeLogin(loginInput) },
    select: { id: true, passwordHash: true, active: true },
  });
  const valid = await verifyPassword(account?.passwordHash ?? (await decoyHash()), password);
  if (!account || !valid) return "invalid";
  if (!account.active) return "disabled";
  await db.clientAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  await openPortalSession(account.id);
  return "ok";
}

export async function signOut() {
  await closePortalSession();
}

/** Détails du journal pour une action du client lui-même. */
function clientActor(session: PortalSession) {
  return { onlineName: session.client.displayName, portal: true };
}

export type ChangePasswordResult = "ok" | "wrong" | "limited";

/** Changement par le client : les autres appareils connectés sont déconnectés. */
export async function changePassword(
  session: PortalSession,
  current: string,
  password: string,
): Promise<ChangePasswordResult> {
  if (!(await allowAttempt(`espace-client:mot-de-passe:${session.account.id}`, CHANGE_RULE))) {
    return "limited";
  }
  const account = await db.clientAccount.findUnique({
    where: { id: session.account.id },
    select: { passwordHash: true },
  });
  if (!account || !(await verifyPassword(account.passwordHash, current))) return "wrong";
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    await tx.clientAccount.update({
      where: { id: session.account.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await tx.clientSession.deleteMany({
      where: { accountId: session.account.id, id: { not: session.sessionId } },
    });
    await tx.clientPasswordReset.deleteMany({ where: { accountId: session.account.id } });
    await logActivity(
      {
        userId: null,
        action: "portal.password_changed",
        entityType: "client",
        entityId: session.client.id,
        label: session.client.displayName,
        details: clientActor(session),
      },
      tx,
    );
  });
  return "ok";
}

/**
 * Mot de passe oublié : un lien (1 heure, usage unique) est envoyé à
 * l'adresse email de la fiche client. Le client indique son identifiant ou
 * cette adresse (plusieurs fiches peuvent partager la même : un email par accès).
 */
export async function requestPasswordReset(input: string, ip: string): Promise<"ok" | "limited"> {
  if (!(await allowAttempt(`espace-client:oubli:${ip}`, FORGOT_RULE))) return "limited";
  const value = input.trim().toLowerCase();
  const accounts = await db.clientAccount.findMany({
    where: {
      active: true,
      ...(value.includes("@") ? { client: { email: value } } : { login: normalizeLogin(value) }),
    },
    take: 5,
    select: {
      id: true,
      login: true,
      client: { select: { displayName: true, email: true, language: true } },
    },
  });
  for (const account of accounts) {
    if (!account.client.email) continue;
    const { token, tokenHash } = generateToken();
    await db.clientPasswordReset.create({
      data: {
        accountId: account.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PORTAL_RESET_MINUTES * 60 * 1000),
      },
    });
    await sendPortalResetEmail(
      {
        name: account.client.displayName,
        email: account.client.email,
        language: account.client.language,
      },
      account.login,
      `${portalUrl(env().APP_URL)}/reinitialiser/${token}`,
    );
  }
  return "ok";
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Lien de réinitialisation encore utilisable, ou `null`. */
export async function findPasswordReset(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const reset = await db.clientPasswordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      accountId: true,
      usedAt: true,
      expiresAt: true,
      account: {
        select: {
          active: true,
          login: true,
          client: { select: { id: true, displayName: true, language: true } },
        },
      },
    },
  });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date() || !reset.account.active) return null;
  return reset;
}

export type ResetResult = "ok" | "invalid" | "limited";

/** Nouveau mot de passe depuis le lien : toutes les sessions ouvertes sont fermées. */
export async function resetPassword(
  token: string,
  password: string,
  ip: string,
): Promise<ResetResult> {
  if (!(await allowAttempt(`espace-client:reinitialiser:${ip}`, RESET_RULE))) return "limited";
  const reset = await findPasswordReset(token);
  if (!reset) return "invalid";
  const passwordHash = await hashPassword(password);
  const client = reset.account.client;
  const done = await db.$transaction(async (tx) => {
    // Usage unique, même si le lien est envoyé deux fois en même temps.
    const claimed = await tx.clientPasswordReset.updateMany({
      where: { id: reset.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return false;
    await tx.clientAccount.update({
      where: { id: reset.accountId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await tx.clientSession.deleteMany({ where: { accountId: reset.accountId } });
    await tx.clientPasswordReset.deleteMany({
      where: { accountId: reset.accountId, id: { not: reset.id } },
    });
    await logActivity(
      {
        userId: null,
        action: "portal.password_reset",
        entityType: "client",
        entityId: client.id,
        label: client.displayName,
        details: { onlineName: client.displayName, portal: true, ip },
      },
      tx,
    );
    return true;
  });
  return done ? "ok" : "invalid";
}
