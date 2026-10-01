import "server-only";
import type { Role } from "@/domain/roles";
import { ROLE_LABELS } from "@/domain/roles";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import { sendInvitationEmail } from "@/server/emails/auth-emails";
import { env } from "@/server/env";
import type { CurrentUser } from "@/server/session";
import { generateToken, hashToken } from "@/server/tokens";
import { createUserWithPassword } from "@/modules/users/create-user";

/** Durée de validité d'un lien d'invitation. */
export const INVITATION_VALIDITY_DAYS = 7;

function invitationExpiry(): Date {
  return new Date(Date.now() + INVITATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

function invitationUrl(token: string): string {
  return `${env().APP_URL}/invitation/${token}`;
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function listUsersAndInvitations() {
  const [users, invitations] = await Promise.all([
    db.user.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    }),
    db.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
      },
    }),
  ]);
  const now = new Date();
  return {
    users,
    invitations: invitations.map((invitation) => ({
      ...invitation,
      expired: invitation.expiresAt < now,
    })),
  };
}

export type InvitationLookup =
  | { status: "valid"; invitation: { email: string; name: string; role: Role } }
  | { status: "invalid" | "expired" | "used" };

/** Retrouve une invitation à partir du jeton reçu dans le lien. */
export async function findInvitationByToken(token: string): Promise<InvitationLookup> {
  const invitation = await db.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invitation || invitation.revokedAt) return { status: "invalid" };
  if (invitation.acceptedAt) return { status: "used" };
  if (invitation.expiresAt < new Date()) return { status: "expired" };
  return {
    status: "valid",
    invitation: { email: invitation.email, name: invitation.name, role: invitation.role },
  };
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

async function deliverInvitation(
  invitation: { name: string; email: string },
  invitedBy: CurrentUser,
  token: string,
) {
  try {
    await sendInvitationEmail(
      invitation,
      invitedBy.name,
      invitationUrl(token),
      INVITATION_VALIDITY_DAYS,
    );
  } catch (error) {
    console.error("Envoi de l'invitation impossible", error);
    throw new UserError(
      "L'email d'invitation n'a pas pu être envoyé. Vérifiez la configuration SMTP (fichier .env).",
    );
  }
}

export async function inviteUser(
  actor: CurrentUser,
  input: { name: string; email: string; role: Role },
) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new UserError("Un utilisateur avec cette adresse email existe déjà.");

  const { token, tokenHash } = generateToken();
  const invitation = await db.$transaction(async (tx) => {
    // Une seule invitation active par adresse : les précédentes sont annulées.
    await tx.invitation.updateMany({
      where: { email: input.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.invitation.create({
      data: { ...input, tokenHash, expiresAt: invitationExpiry(), invitedById: actor.id },
    });
  });

  try {
    await deliverInvitation(invitation, actor, token);
  } catch (error) {
    // Sans email, l'invitation est inutilisable : on l'annule.
    await db.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
    throw error;
  }

  await logActivity({
    userId: actor.id,
    action: "user.invited",
    entityType: "invitation",
    entityId: invitation.id,
    label: invitation.email,
    details: { role: invitation.role },
  });
}

/** Renvoie l'invitation avec un nouveau lien (l'ancien ne fonctionne plus). */
export async function resendInvitation(actor: CurrentUser, invitationId: string) {
  const invitation = await db.invitation.findFirst({
    where: { id: invitationId, acceptedAt: null, revokedAt: null },
  });
  if (!invitation) throw new UserError("Cette invitation n'existe plus.");

  const { token, tokenHash } = generateToken();
  await db.invitation.update({
    where: { id: invitation.id },
    data: { tokenHash, expiresAt: invitationExpiry() },
  });
  await deliverInvitation(invitation, actor, token);
  await logActivity({
    userId: actor.id,
    action: "user.invitation_resent",
    entityType: "invitation",
    entityId: invitation.id,
    label: invitation.email,
  });
}

export async function revokeInvitation(actor: CurrentUser, invitationId: string) {
  const invitation = await db.invitation.findFirst({
    where: { id: invitationId, acceptedAt: null, revokedAt: null },
  });
  if (!invitation) throw new UserError("Cette invitation n'existe plus.");
  await db.invitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
  await logActivity({
    userId: actor.id,
    action: "user.invitation_revoked",
    entityType: "invitation",
    entityId: invitation.id,
    label: invitation.email,
  });
}

/**
 * Activation du compte par la personne invitée : crée l'utilisateur et son mot
 * de passe, puis marque l'invitation comme utilisée (le tout en une transaction).
 */
export async function acceptInvitation(input: { token: string; name: string; password: string }) {
  return db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash: hashToken(input.token) },
    });
    if (!invitation || invitation.revokedAt)
      throw new UserError("Ce lien d'invitation n'est pas valide.");
    if (invitation.acceptedAt) throw new UserError("Cette invitation a déjà été utilisée.");
    if (invitation.expiresAt < new Date()) {
      throw new UserError(
        "Ce lien d'invitation a expiré. Demandez à un administrateur de vous le renvoyer.",
      );
    }
    if (await tx.user.findUnique({ where: { email: invitation.email } })) {
      throw new UserError("Un compte existe déjà pour cette adresse email. Connectez-vous.");
    }

    const user = await createUserWithPassword(tx, {
      name: input.name,
      email: invitation.email,
      role: invitation.role,
      password: input.password,
    });
    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await logActivity(
      {
        userId: user.id,
        action: "user.invitation_accepted",
        entityType: "user",
        entityId: user.id,
        label: user.email,
      },
      tx,
    );
    return { email: user.email };
  });
}

// ---------------------------------------------------------------------------
// Rôles et désactivation
// ---------------------------------------------------------------------------

/** Empêche de retirer le dernier admin actif (sinon plus personne ne gère l'outil). */
async function assertAnotherActiveAdmin(userId: string) {
  const otherAdmins = await db.user.count({
    where: { role: "ADMIN", active: true, id: { not: userId } },
  });
  if (otherAdmins === 0) {
    throw new UserError("Impossible : il doit toujours rester au moins un administrateur actif.");
  }
}

export async function changeUserRole(actor: CurrentUser, userId: string, role: Role) {
  if (userId === actor.id) throw new UserError("Vous ne pouvez pas modifier votre propre rôle.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserError("Utilisateur introuvable.");
  if (user.role === role) return;
  if (user.role === "ADMIN") await assertAnotherActiveAdmin(user.id);

  await db.user.update({ where: { id: user.id }, data: { role } });
  await logActivity({
    userId: actor.id,
    action: "user.role_changed",
    entityType: "user",
    entityId: user.id,
    label: user.email,
    details: {
      from: user.role,
      to: role,
      fromLabel: ROLE_LABELS[user.role],
      toLabel: ROLE_LABELS[role],
    },
  });
}

export async function setUserActive(actor: CurrentUser, userId: string, active: boolean) {
  if (userId === actor.id)
    throw new UserError("Vous ne pouvez pas désactiver votre propre compte.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserError("Utilisateur introuvable.");
  if (user.active === active) return;
  if (!active && user.role === "ADMIN") await assertAnotherActiveAdmin(user.id);

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { active } });
    // Déconnexion immédiate sur tous ses appareils.
    if (!active) await tx.session.deleteMany({ where: { userId: user.id } });
    await logActivity(
      {
        userId: actor.id,
        action: active ? "user.reactivated" : "user.deactivated",
        entityType: "user",
        entityId: user.id,
        label: user.email,
      },
      tx,
    );
  });
}
