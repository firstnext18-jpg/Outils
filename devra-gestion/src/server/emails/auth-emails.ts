import "server-only";
import { displayCompanyName, getSettings } from "@/modules/settings/service";
import { sendMail } from "@/server/mailer";
import { renderSimpleEmail } from "@/server/emails/layout";

export async function sendPasswordResetEmail(to: { name: string; email: string }, url: string) {
  const companyName = displayCompanyName(await getSettings());
  const { text, html } = renderSimpleEmail({
    companyName,
    greeting: `Bonjour ${to.name},`,
    paragraphs: [
      "Vous avez demandé à réinitialiser votre mot de passe pour l'outil de gestion.",
      "Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.",
    ],
    action: { label: "Choisir un nouveau mot de passe", url },
    footnote: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.",
  });
  await sendMail({
    to: { name: to.name, address: to.email },
    subject: `${companyName} — Réinitialisation du mot de passe`,
    text,
    html,
  });
}

export async function sendInvitationEmail(
  to: { name: string; email: string },
  invitedBy: string,
  url: string,
  expiresInDays: number,
) {
  const companyName = displayCompanyName(await getSettings());
  const { text, html } = renderSimpleEmail({
    companyName,
    greeting: `Bonjour ${to.name},`,
    paragraphs: [
      `${invitedBy} vous invite à rejoindre l'outil de gestion de ${companyName} (clients, devis et factures).`,
      `Pour activer votre compte, choisissez votre mot de passe. Ce lien est valable ${expiresInDays} jours.`,
    ],
    action: { label: "Activer mon compte", url },
  });
  await sendMail({
    to: { name: to.name, address: to.email },
    subject: `${companyName} — Invitation à l'outil de gestion`,
    text,
    html,
  });
}
