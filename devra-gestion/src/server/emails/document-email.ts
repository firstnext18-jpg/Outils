import { textToHtmlParagraphs } from "@/domain/email-template";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Email d'envoi d'un devis ou d'une facture : le texte saisi tel quel, et une
 * version HTML sobre (paragraphes, nom de l'entreprise en tête).
 */
export function renderDocumentEmail(email: { companyName: string; body: string }) {
  const paragraphs = textToHtmlParagraphs(email.body)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${p}</p>`)
    .join("\n        ");
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
      <tr><td>
        ${email.companyName ? `<p style="margin:0 0 24px;font-size:14px;color:#71717a;">${escapeHtml(email.companyName)}</p>` : ""}
        ${paragraphs}
      </td></tr>
    </table>
  </body>
</html>`;
  return { text: email.body, html };
}
