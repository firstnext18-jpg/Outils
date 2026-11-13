import "server-only";
import { addDays, dbDateToIso, formatIsoDate, isoToDbDate } from "@/domain/dates";
import { portalUrl } from "@/domain/portal";
import { renderTemplate, type EmailValues } from "@/domain/email-template";
import { formatChf } from "@/lib/format";
import type { SendEmailData } from "@/modules/emails/schemas";
import {
  getInvoice,
  issueInvoice,
  recordInvoiceEmailed,
  type InvoiceDetail,
} from "@/modules/invoices/service";
import { getQuote, recordQuoteEmailed, type QuoteDetail } from "@/modules/quotes/service";
import {
  clientSnapshot,
  companySnapshot,
  type ClientSnapshot,
  type CompanySnapshot,
} from "@/modules/settings/documents";
import { documentLabels } from "@/i18n/documents";
import { createQuoteLink } from "@/modules/online-quotes/service";
import { getSettings, type AppSettings } from "@/modules/settings/service";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { env } from "@/server/env";
import { db } from "@/server/db";
import { emailBranding } from "@/server/emails/branding";
import { renderDocumentEmail, type DocumentEmailSummary } from "@/server/emails/document-email";
import { sendMail } from "@/server/mailer";
import { invoicePdfForDownload, invoiceTitleLabel } from "@/server/pdf/invoice-pdf";
import { buildQuotePdf } from "@/server/pdf/quote-pdf";
import type { CurrentUser } from "@/server/session";

// ---------------------------------------------------------------------------
// Variables et brouillon d'email
// ---------------------------------------------------------------------------

type Client = Pick<ClientSnapshot, "displayName" | "kind" | "contactName">;

/** {client} : la personne de contact d'une entreprise si elle est renseignée, sinon le nom. */
function clientName(client: Client) {
  return (client.kind === "COMPANY" && client.contactName.trim()) || client.displayName;
}

function quoteAmount(quote: QuoteDetail) {
  if (quote.totalCents > 0) return formatChf(quote.totalCents);
  const recurring = [
    [quote.recurringMonthlyCents, "mois"],
    [quote.recurringQuarterlyCents, "trimestre"],
    [quote.recurringYearlyCents, "an"],
  ] as const;
  return (
    recurring
      .filter(([cents]) => cents > 0)
      .map(([cents, unit]) => `${formatChf(cents)} / ${unit}`)
      .join(" + ") || formatChf(0)
  );
}

function quoteValues(quote: QuoteDetail, settings: AppSettings): EmailValues {
  const company = (quote.companySnapshot as CompanySnapshot | null) ?? companySnapshot(settings);
  return {
    client: clientName((quote.clientSnapshot as ClientSnapshot | null) ?? quote.client),
    numero: quote.number,
    montant: quoteAmount(quote),
    echeance: formatIsoDate(dbDateToIso(quote.validUntil)),
    // Avec l'acceptation en ligne, {lien} reste tel quel dans la fenêtre d'envoi : le
    // lien n'est créé qu'à l'envoi. Sans elle, la ligne qui le contient est retirée.
    ...(settings.onlineAcceptance ? {} : { lien: "" }),
    entreprise: company.name,
  };
}

function invoiceValues(invoice: InvoiceDetail, settings: AppSettings): EmailValues {
  const company = (invoice.companySnapshot as CompanySnapshot | null) ?? companySnapshot(settings);
  return {
    client: clientName((invoice.clientSnapshot as ClientSnapshot | null) ?? invoice.client),
    // Une facture en brouillon n'a pas encore de numéro : {numero} est remplacé à l'émission.
    ...(invoice.number ? { numero: invoice.number } : {}),
    montant: formatChf(invoice.amountDueCents),
    echeance: formatIsoDate(dbDateToIso(invoice.dueDate)),
    lien: "",
    entreprise: company.name,
  };
}

function templates(settings: AppSettings, kind: "quote" | "invoice", language: "FR" | "DE") {
  const de = language === "DE";
  return kind === "quote"
    ? {
        subject: de ? settings.quoteEmailSubjectDe : settings.quoteEmailSubjectFr,
        body: de ? settings.quoteEmailBodyDe : settings.quoteEmailBodyFr,
      }
    : {
        subject: de ? settings.invoiceEmailSubjectDe : settings.invoiceEmailSubjectFr,
        body: de ? settings.invoiceEmailBodyDe : settings.invoiceEmailBodyFr,
      };
}

export type EmailDraft = { to: string; subject: string; body: string };

/** Valeurs proposées dans la fenêtre d'envoi (modèle de la langue du document). */
export function quoteEmailDraft(quote: QuoteDetail, settings: AppSettings): EmailDraft {
  const template = templates(settings, "quote", quote.language);
  const values = quoteValues(quote, settings);
  return {
    to: quote.client.email,
    subject: renderTemplate(template.subject, values),
    body: renderTemplate(template.body, values),
  };
}

export function invoiceEmailDraft(invoice: InvoiceDetail, settings: AppSettings): EmailDraft {
  const template = templates(settings, "invoice", invoice.language);
  const values = invoiceValues(invoice, settings);
  return {
    to: invoice.client.email,
    subject: renderTemplate(template.subject, values),
    body: renderTemplate(template.body, values),
  };
}

// ---------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------

export type Delivery = {
  /** Vide pour un envoi automatique (tâche quotidienne). */
  actor: CurrentUser | null;
  data: SendEmailData;
  settings: AppSettings;
  /** Langue du document : libellés du récapitulatif et du bouton. */
  language: "FR" | "DE";
  subject: string;
  body: string;
  /** Récapitulatif en tête de l'email (le libellé de la pièce jointe est ajouté ici). */
  summary: Omit<DocumentEmailSummary, "attachmentLabel">;
  /** Lien d'acceptation du devis en ligne, s'il figure dans le texte. */
  onlineLink?: string;
  attachment: { fileName: string; buffer: Buffer };
  link: { quoteId: string } | { invoiceId: string };
};

/** Envoie l'email et l'inscrit dans l'historique du document, qu'il réussisse ou non. */
export async function deliver(
  delivery: Delivery,
): Promise<{ ok: true; logId: string } | { ok: false; error: string; logId: string }> {
  const { actor, data, settings } = delivery;
  const bcc = data.copyToSender && actor ? [actor.email.toLowerCase()] : [];
  const labels = documentLabels(delivery.language);
  const { branding, attachments: brandingAttachments } = await emailBranding(settings);
  const { text, html } = renderDocumentEmail({
    language: delivery.language,
    branding,
    subject: delivery.subject,
    body: delivery.body,
    summary: { ...delivery.summary, attachmentLabel: labels.emailPdfAttached },
    ...(delivery.onlineLink
      ? { onlineLink: { label: labels.emailViewQuoteOnline, url: delivery.onlineLink } }
      : {}),
  });
  let error = "";
  try {
    await sendMail({
      to: data.to,
      bcc,
      // Les réponses du client arrivent sur l'adresse de l'entreprise (Paramètres → Entreprise).
      replyTo: settings.companyEmail || undefined,
      subject: delivery.subject,
      text,
      html,
      attachments: [
        {
          filename: delivery.attachment.fileName,
          content: delivery.attachment.buffer,
          contentType: "application/pdf",
        },
        ...brandingAttachments,
      ],
    });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
    console.error("Envoi d'email impossible", cause);
  }
  const log = await db.emailLog.create({
    data: {
      ...delivery.link,
      recipients: data.to,
      bcc,
      subject: delivery.subject,
      body: delivery.body,
      attachment: delivery.attachment.fileName,
      status: error ? "FAILED" : "SENT",
      error,
      sentById: actor?.id ?? null,
    },
  });
  return error ? { ok: false, error, logId: log.id } : { ok: true, logId: log.id };
}

/**
 * Envoi d'un devis. Un brouillon part comme devis définitif (coordonnées
 * figées, sans filigrane) et passe en « envoyé » si l'envoi réussit.
 */
export async function sendQuoteEmail(actor: CurrentUser, data: SendEmailData) {
  const [quote, settings] = await Promise.all([getQuote(data.id), getSettings()]);
  if (!quote) throw new UserError("Ce devis n'existe plus.");

  const snapshots =
    quote.status === "DRAFT"
      ? { clientSnapshot: clientSnapshot(quote.client), companySnapshot: companySnapshot(settings) }
      : null;
  const sendable: QuoteDetail = snapshots ? { ...quote, ...snapshots, status: "SENT" } : quote;
  const values = quoteValues(sendable, settings);
  if (settings.onlineAcceptance && `${data.subject}\n${data.body}`.includes("{lien}")) {
    values.lien = await createQuoteLink(quote);
  }
  const attachment = await buildQuotePdf(sendable, settings);

  const labels = documentLabels(quote.language);
  const result = await deliver({
    actor,
    data,
    settings,
    language: quote.language,
    subject: renderTemplate(data.subject, values),
    body: renderTemplate(data.body, values),
    summary: {
      title: `${labels.quote} ${quote.number}`,
      amount: values.montant ?? "",
      dateLabel: labels.validUntil,
      date: values.echeance ?? "",
    },
    ...(values.lien ? { onlineLink: values.lien } : {}),
    attachment,
    link: { quoteId: quote.id },
  });
  if (!result.ok) {
    throw new UserError(`L'email n'a pas pu être envoyé : ${result.error}`);
  }
  await recordQuoteEmailed(actor, quote, snapshots, data.to);
  return { number: quote.number, statusChanged: Boolean(snapshots) };
}

/**
 * Envoi d'une facture. Un brouillon est d'abord émis (numéro, référence,
 * PDF archivé) : si l'envoi échoue ensuite, la facture reste émise et
 * l'envoi peut être relancé.
 */
export async function sendInvoiceEmail(actor: CurrentUser | null, data: SendEmailData) {
  let invoice = await getInvoice(data.id);
  if (!invoice) throw new UserError("Cette facture n'existe plus.");
  if (invoice.status === "CANCELLED") throw new UserError("Une facture annulée ne s'envoie pas.");

  let issuedNow = false;
  if (invoice.status === "DRAFT") {
    await issueInvoice(actor, invoice.id, data.version ?? -1);
    issuedNow = true;
    invoice = (await getInvoice(data.id))!;
  }
  const settings = await getSettings();
  const values = invoiceValues(invoice, settings);
  const attachment = await invoicePdfForDownload(invoice, settings);

  const labels = documentLabels(invoice.language);
  const result = await deliver({
    actor,
    data,
    settings,
    language: invoice.language,
    subject: renderTemplate(data.subject, values),
    body: renderTemplate(data.body, values),
    summary: {
      title: `${invoiceTitleLabel(invoice.type, labels)} ${invoice.number}`,
      amount: values.montant ?? "",
      dateLabel: labels.dueDate,
      date: values.echeance ?? "",
    },
    attachment,
    link: { invoiceId: invoice.id },
  });
  if (!result.ok) {
    throw new UserError(
      issuedNow
        ? `La facture ${invoice.number} a été émise, mais l'email n'a pas pu être envoyé : ${result.error}. Vous pouvez relancer l'envoi depuis la facture.`
        : `L'email n'a pas pu être envoyé : ${result.error}`,
    );
  }
  await recordInvoiceEmailed(actor, invoice, data.to);
  return { number: invoice.number, issuedNow };
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

export function listEmailLogs(where: { quoteId: string } | { invoiceId: string }) {
  return db.emailLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      recipients: true,
      bcc: true,
      subject: true,
      attachment: true,
      status: true,
      error: true,
      createdAt: true,
      sentBy: { select: { name: true } },
    },
  });
}

export type EmailLogRow = Awaited<ReturnType<typeof listEmailLogs>>[number];

// ---------------------------------------------------------------------------
// Relance d'un devis avant la fin de sa validité
// ---------------------------------------------------------------------------

/**
 * Relance du client pour un devis envoyé : modèle « Relance des devis »
 * (Paramètres → Emails), PDF joint, lien d'acceptation en ligne (ou lien de
 * l'espace client s'il y a accès). Automatique (tâche quotidienne, une seule
 * fois) ou à la demande depuis la page du devis.
 */
export async function sendQuoteReminder(actor: CurrentUser | null, quoteId: string) {
  const [quote, settings] = await Promise.all([getQuote(quoteId), getSettings()]);
  if (!quote) throw new UserError("Ce devis n'existe plus.");
  if (quote.status !== "SENT")
    throw new UserError("Seul un devis envoyé, sans réponse, se relance.");
  const to = quote.client.email;
  if (!to) throw new UserError("Ce client n'a pas d'adresse email sur sa fiche.");

  const de = quote.language === "DE";
  const subjectTemplate = de ? settings.quoteReminderSubjectDe : settings.quoteReminderSubjectFr;
  const bodyTemplate = de ? settings.quoteReminderBodyDe : settings.quoteReminderBodyFr;
  const values = quoteValues(quote, settings);
  if (bodyTemplate.includes("{lien}")) {
    if (settings.onlineAcceptance) {
      values.lien = await createQuoteLink(quote);
    } else {
      const account = await db.clientAccount.findUnique({
        where: { clientId: quote.clientId },
        select: { active: true },
      });
      values.lien = account?.active ? `${portalUrl(env().APP_URL)}/devis/${quote.id}` : "";
    }
  }
  const attachment = await buildQuotePdf(quote, settings);
  const labels = documentLabels(quote.language);
  const subject = renderTemplate(subjectTemplate, values);
  const result = await deliver({
    actor,
    data: {
      kind: "quote",
      id: quote.id,
      to: [to],
      subject,
      body: bodyTemplate,
      copyToSender: false,
    },
    settings,
    language: quote.language,
    subject,
    body: renderTemplate(bodyTemplate, values),
    summary: {
      title: `${labels.quote} ${quote.number}`,
      amount: values.montant ?? "",
      dateLabel: labels.validUntil,
      date: values.echeance ?? "",
    },
    ...(values.lien && settings.onlineAcceptance ? { onlineLink: values.lien } : {}),
    attachment,
    link: { quoteId: quote.id },
  });
  if (!result.ok) throw new UserError(`L'email n'a pas pu être envoyé : ${result.error}`);
  await db.quote.update({ where: { id: quote.id }, data: { reminderSentAt: new Date() } });
  await logActivity({
    userId: actor?.id ?? null,
    action: "quote.reminded",
    entityType: "quote",
    entityId: quote.id,
    label: quote.number,
    details: { to: [to], automatic: actor === null },
  });
  return { to };
}

/** Tâche quotidienne : relance les devis qui expirent dans les prochains jours (une fois chacun). */
export async function sendDueQuoteReminders(today: string) {
  const settings = await getSettings();
  if (!settings.quoteReminderEnabled) return { sent: 0, failed: 0, skipped: true };
  const limit = addDays(today, settings.quoteReminderDays);
  const quotes = await db.quote.findMany({
    where: {
      status: "SENT",
      reminderSentAt: null,
      validUntil: { gte: isoToDbDate(today), lte: isoToDbDate(limit) },
      client: { email: { not: "" } },
    },
    select: { id: true },
  });
  let sent = 0;
  let failed = 0;
  for (const quote of quotes) {
    try {
      await sendQuoteReminder(null, quote.id);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`Relance du devis ${quote.id} impossible`, error);
    }
  }
  return { sent, failed, skipped: false };
}
