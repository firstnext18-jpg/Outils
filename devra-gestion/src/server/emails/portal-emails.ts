import "server-only";
import { portalUrl } from "@/domain/portal";
import { fillLabel } from "@/i18n/documents";
import { portalTexts, type PortalLanguage } from "@/i18n/portal";
import { getSettings } from "@/modules/settings/service";
import { env } from "@/server/env";
import { sendMail } from "@/server/mailer";
import { emailBranding } from "@/server/emails/branding";
import { renderSimpleEmail } from "@/server/emails/layout";

/** Emails envoyés aux clients au sujet de leur espace client, dans leur langue. */
type Recipient = { name: string; email: string; language: PortalLanguage };

async function send(
  to: Recipient,
  build: (company: string) => Omit<Parameters<typeof renderSimpleEmail>[0], "branding">,
) {
  const { branding, attachments } = await emailBranding(await getSettings());
  const email = build(branding.name);
  const { text, html } = renderSimpleEmail({ ...email, branding });
  await sendMail({
    to: { name: to.name, address: to.email },
    subject: email.title,
    text,
    html,
    attachments,
  });
}

/** Identifiant et mot de passe, envoyés à la demande de l'équipe. */
export async function sendPortalCredentialsEmail(
  to: Recipient,
  credentials: { login: string; password: string },
) {
  const t = portalTexts(to.language);
  const url = portalUrl(env().APP_URL);
  await send(to, (company) => ({
    language: to.language,
    title: fillLabel(t.credentialsSubject, { company }),
    greeting: t.emailGreeting,
    paragraphs: [t.credentialsIntro, t.credentialsChange],
    details: [
      { label: t.address, value: url },
      { label: t.login, value: credentials.login },
      { label: t.password, value: credentials.password },
    ],
    action: { label: t.openPortal, url: `${url}/connexion` },
    footnote: t.credentialsKeep,
  }));
}

/** Nouveau message de l'équipe dans la discussion (un email par série de messages non lus). */
export async function sendPortalMessageEmail(
  to: Recipient,
  message: { author: string; excerpt: string },
) {
  const t = portalTexts(to.language);
  await send(to, (company) => ({
    language: to.language,
    title: fillLabel(t.messageSubject, { company }),
    greeting: t.emailGreeting,
    paragraphs: [
      fillLabel(t.messageIntro, { author: message.author }),
      `« ${message.excerpt} »`,
      t.messageOutro,
    ],
    action: { label: t.readMessage, url: `${portalUrl(env().APP_URL)}/discussion` },
  }));
}

/** Lien « mot de passe oublié » (valable 1 heure, usage unique). */
export async function sendPortalResetEmail(to: Recipient, login: string, url: string) {
  const t = portalTexts(to.language);
  await send(to, (company) => ({
    language: to.language,
    title: fillLabel(t.resetSubject, { company }),
    greeting: t.emailGreeting,
    paragraphs: [fillLabel(t.resetIntro, { login }), t.resetValidity],
    action: { label: t.resetAction, url },
    footnote: t.resetIgnore,
  }));
}
