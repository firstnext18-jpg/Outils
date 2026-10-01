import "server-only";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
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
import { getSettings, type AppSettings } from "@/modules/settings/service";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import { renderDocumentEmail } from "@/server/emails/document-email";
import { sendMail } from "@/server/mailer";
import { invoicePdfForDownload } from "@/server/pdf/invoice-pdf";
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
    // Lien d'acceptation en ligne : option prévue en phase 9.
    lien: "",
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
  companyName: string;
  subject: string;
  body: string;
  attachment: { fileName: string; buffer: Buffer };
  link: { quoteId: string } | { invoiceId: string };
};

/** Envoie l'email et l'inscrit dans l'historique du document, qu'il réussisse ou non. */
export async function deliver(
  delivery: Delivery,
): Promise<{ ok: true; logId: string } | { ok: false; error: string; logId: string }> {
  const { actor, data, settings } = delivery;
  const bcc = data.copyToSender && actor ? [actor.email.toLowerCase()] : [];
  const { text, html } = renderDocumentEmail({
    companyName: delivery.companyName,
    body: delivery.body,
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
  const attachment = await buildQuotePdf(sendable, settings);

  const result = await deliver({
    actor,
    data,
    settings,
    companyName: values.entreprise ?? "",
    subject: renderTemplate(data.subject, values),
    body: renderTemplate(data.body, values),
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

  const result = await deliver({
    actor,
    data,
    settings,
    companyName: values.entreprise ?? "",
    subject: renderTemplate(data.subject, values),
    body: renderTemplate(data.body, values),
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
