import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
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
  "to" | "cc" | "bcc" | "replyTo" | "subject" | "text" | "html" | "attachments"
>;

/** Envoie un email via le serveur SMTP configuré dans `.env`. */
export async function sendMail(message: MailMessage): Promise<{ messageId: string }> {
  const info = await getTransporter().sendMail({ from: env().SMTP_FROM, ...message });
  return { messageId: info.messageId };
}
