import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Mail from "nodemailer/lib/mailer";
import { env } from "@/server/env";

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const e = env();
  transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD ?? "" } : undefined,
  });
  return transporter;
}

export type MailMessage = Pick<
  Mail.Options,
  | "to"
  | "cc"
  | "bcc"
  | "replyTo"
  | "subject"
  | "text"
  | "html"
  | "attachments"
  | "messageId"
  | "inReplyTo"
  | "references"
  | "date"
>;

/** Envoie un email via le serveur SMTP configuré dans `.env`. */
export async function sendMail(message: MailMessage): Promise<{ messageId: string }> {
  const info = await getTransporter().sendMail({ from: env().SMTP_FROM, ...message });
  return { messageId: info.messageId };
}

/** Message complet (format .eml), identique à celui envoyé : pour la copie dans « Envoyés ». */
export function buildRawMail(message: MailMessage): Promise<Buffer> {
  return new MailComposer({ from: env().SMTP_FROM, ...message }).compile().build();
}

/** Le serveur d'envoi garde-t-il lui-même une copie dans « Envoyés » ? (Gmail : oui.) */
export function smtpSavesSentCopy(): boolean {
  return /(^|\.)(gmail|googlemail)\.com$/i.test(env().SMTP_HOST);
}
