import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { generateLogin, generatePassword } from "@/domain/portal";
import { ensureClientDiscussion } from "@/modules/discussions/service";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import { sendPortalCredentialsEmail } from "@/server/emails/portal-emails";
import { hashPassword, verifyPassword } from "@/server/password";
import type { CurrentUser } from "@/server/session";

/**
 * Accès des clients à leur espace, géré par l'équipe depuis la fiche client :
 * création (identifiant et mot de passe générés, affichés une seule fois),
 * nouveau mot de passe, désactivation. Le mot de passe en clair n'est jamais
 * enregistré : seule son empreinte Argon2id l'est.
 */

export type PortalCredentials = { login: string; password: string };

/** Accès du client, s'il existe (sans l'empreinte du mot de passe). */
export function getPortalAccess(clientId: string) {
  return db.clientAccount.findUnique({
    where: { clientId },
    select: {
      login: true,
      active: true,
      createdAt: true,
      lastLoginAt: true,
      passwordChangedAt: true,
      createdBy: { select: { name: true } },
    },
  });
}

export type PortalAccessSummary = NonNullable<Awaited<ReturnType<typeof getPortalAccess>>>;

async function clientOrThrow(clientId: string) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      displayName: true,
      email: true,
      language: true,
      account: {
        select: {
          id: true,
          passwordHash: true,
          login: true,
          active: true,
          passwordChangedAt: true,
        },
      },
    },
  });
  if (!client) throw new UserError("Ce client n'existe plus.");
  return client;
}

/** Identifiant libre (31⁸ possibilités : une collision est très improbable). */
async function freeLogin(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const login = generateLogin();
    const taken = await db.clientAccount.findUnique({ where: { login }, select: { id: true } });
    if (!taken) return login;
  }
  throw new Error("Impossible de générer un identifiant libre");
}

/** Crée l'accès du client et sa discussion avec l'équipe. */
export async function createPortalAccess(
  actor: CurrentUser,
  clientId: string,
): Promise<PortalCredentials> {
  const client = await clientOrThrow(clientId);
  if (client.account) throw new UserError("Ce client a déjà un accès à l'espace client.");
  const password = generatePassword();
  const [login, passwordHash] = await Promise.all([freeLogin(), hashPassword(password)]);
  try {
    await db.$transaction(async (tx) => {
      await tx.clientAccount.create({
        data: { clientId, login, passwordHash, createdById: actor.id },
      });
      await logActivity(
        {
          userId: actor.id,
          action: "portal.access_created",
          entityType: "client",
          entityId: clientId,
          label: client.displayName,
          details: { login },
        },
        tx,
      );
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UserError("Ce client a déjà un accès à l'espace client.");
    }
    throw error;
  }
  await ensureClientDiscussion(clientId);
  return { login, password };
}

/** Nouveau mot de passe (client qui a oublié le sien) : les sessions ouvertes sont fermées. */
export async function regeneratePortalPassword(
  actor: CurrentUser,
  clientId: string,
): Promise<PortalCredentials> {
  const client = await clientOrThrow(clientId);
  if (!client.account) throw new UserError("Ce client n'a pas encore d'accès à l'espace client.");
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const accountId = client.account.id;
  await db.$transaction(async (tx) => {
    // Mot de passe à nouveau généré par l'équipe (et non plus choisi par le client).
    await tx.clientAccount.update({
      where: { id: accountId },
      data: { passwordHash, passwordChangedAt: null },
    });
    await tx.clientSession.deleteMany({ where: { accountId } });
    await tx.clientPasswordReset.deleteMany({ where: { accountId } });
    await logActivity(
      {
        userId: actor.id,
        action: "portal.password_regenerated",
        entityType: "client",
        entityId: clientId,
        label: client.displayName,
      },
      tx,
    );
  });
  return { login: client.account.login, password };
}

/** Désactive (sessions fermées) ou réactive l'accès. */
export async function setPortalAccessActive(actor: CurrentUser, clientId: string, active: boolean) {
  const client = await clientOrThrow(clientId);
  if (!client.account) throw new UserError("Ce client n'a pas encore d'accès à l'espace client.");
  if (client.account.active === active) return;
  const accountId = client.account.id;
  await db.$transaction(async (tx) => {
    await tx.clientAccount.update({ where: { id: accountId }, data: { active } });
    if (!active) {
      await tx.clientSession.deleteMany({ where: { accountId } });
      await tx.clientPasswordReset.deleteMany({ where: { accountId } });
    }
    await logActivity(
      {
        userId: actor.id,
        action: active ? "portal.access_enabled" : "portal.access_disabled",
        entityType: "client",
        entityId: clientId,
        label: client.displayName,
      },
      tx,
    );
  });
  if (active) await ensureClientDiscussion(clientId);
}

/**
 * Envoie l'identifiant et le mot de passe au client, juste après leur
 * affichage. Le mot de passe est renvoyé par le navigateur : il doit
 * correspondre à celui enregistré (pas d'envoi d'un autre texte).
 */
export async function emailPortalCredentials(
  actor: CurrentUser,
  clientId: string,
  password: string,
): Promise<{ email: string }> {
  const client = await clientOrThrow(clientId);
  if (!client.account) throw new UserError("Ce client n'a pas encore d'accès à l'espace client.");
  if (!client.email) throw new UserError("Ce client n'a pas d'adresse email sur sa fiche.");
  // Seul un mot de passe généré s'envoie : celui choisi par le client ne doit pas pouvoir être
  // deviné en essayant cet envoi.
  if (client.account.passwordChangedAt) {
    throw new UserError(
      "Le client a choisi son propre mot de passe : générez-en un nouveau pour le lui envoyer.",
    );
  }
  if (!(await verifyPassword(client.account.passwordHash, password))) {
    throw new UserError("Ce mot de passe n'est plus valable : générez-en un nouveau.");
  }
  await sendPortalCredentialsEmail(
    { name: client.displayName, email: client.email, language: client.language },
    { login: client.account.login, password },
  );
  await logActivity({
    userId: actor.id,
    action: "portal.credentials_emailed",
    entityType: "client",
    entityId: clientId,
    label: client.displayName,
    details: { to: client.email },
  });
  return { email: client.email };
}
