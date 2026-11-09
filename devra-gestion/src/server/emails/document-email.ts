import { textToHtmlParagraphs } from "@/domain/email-template";
import {
  EMAIL_COLORS as C,
  escapeHtml,
  renderEmailButton,
  renderEmailParagraph,
  renderEmailShell,
  type EmailBranding,
} from "@/server/emails/layout";

/** Récapitulatif affiché en tête de l'email d'un devis, d'une facture ou d'une relance. */
export type DocumentEmailSummary = {
  /** Ex. « Facture F-2026-014 », « Rappel – Facture F-2026-014 ». */
  title: string;
  /** Montant formaté, ex. « CHF 1'250.00 ». */
  amount: string;
  /** Ex. « Échéance », « Valable jusqu'au ». */
  dateLabel: string;
  date: string;
  /** Ex. « PDF joint ». */
  attachmentLabel: string;
};

/** Rend cliquables les adresses web d'un texte déjà échappé. */
function linkify(html: string): string {
  return html.replace(/https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<])+/g, (match) => {
    const url = match.replace(/[.,;:!?)]+$/, "");
    return `<a href="${url}" style="color:${C.accent};text-decoration:underline;word-break:break-all;">${url}</a>${match.slice(url.length)}`;
  });
}

/** Garde d'un seul tenant les mots qui contiennent des chiffres (« F-2026-014 », dates). */
function keepNumbersTogether(text: string): string {
  return text
    .split(" ")
    .map((word) =>
      /\d/.test(word)
        ? `<span style="white-space:nowrap;">${escapeHtml(word)}</span>`
        : escapeHtml(word),
    )
    .join(" ");
}

function summaryCard(summary: DocumentEmailSummary): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:${C.panel};border:1px solid ${C.border};border-radius:8px;">
                  <tr><td style="padding:16px 20px;">
                    <div style="font-size:14px;font-weight:600;line-height:1.4;color:${C.text};">${keepNumbersTogether(summary.title)}</div>
                    <div style="margin-top:6px;font-size:24px;font-weight:700;line-height:1.2;color:${C.accent};white-space:nowrap;">${escapeHtml(summary.amount)}</div>
                    <div style="margin-top:6px;font-size:13px;line-height:1.4;color:${C.muted};">${keepNumbersTogether(`${summary.dateLabel} ${summary.date}`)} · ${escapeHtml(summary.attachmentLabel)}</div>
                  </td></tr>
                </table>`;
}

/**
 * Email d'envoi d'un devis, d'une facture ou d'une relance. Le texte saisi
 * part tel quel (version texte) ; la version HTML ajoute l'en-tête, un
 * récapitulatif du document et, pour le lien d'acceptation en ligne, un bouton
 * à l'endroit où le lien figure dans le texte.
 */
export function renderDocumentEmail(email: {
  language: "FR" | "DE";
  branding: EmailBranding;
  subject: string;
  body: string;
  summary: DocumentEmailSummary;
  onlineLink?: { label: string; url: string };
}): { text: string; html: string } {
  const link = email.onlineLink;
  const linkHtml = link ? escapeHtml(link.url) : "";
  const blocks = textToHtmlParagraphs(email.body).map((paragraph) => {
    if (!link || !paragraph.includes(linkHtml)) return renderEmailParagraph(linkify(paragraph));
    const rest = paragraph.replace(linkHtml, "").replace(/(?:\s|<br>)+$/, "");
    return [
      ...(rest ? [renderEmailParagraph(linkify(rest))] : []),
      renderEmailButton(link.label, link.url),
    ].join("\n                ");
  });

  const { summary } = email;
  const html = renderEmailShell({
    lang: email.language === "DE" ? "de" : "fr",
    title: email.subject,
    preheader: `${summary.title} · ${summary.amount} · ${summary.dateLabel} ${summary.date}`,
    branding: email.branding,
    content: [summaryCard(summary), ...blocks].join("\n                "),
  });
  return { text: email.body, html };
}
