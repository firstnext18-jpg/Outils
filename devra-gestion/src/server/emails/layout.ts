/**
 * Mise en page commune des emails envoyés aux utilisateurs de l'outil
 * (invitation, réinitialisation du mot de passe). Sobre : texte noir sur blanc.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type SimpleEmail = {
  companyName: string;
  greeting: string;
  paragraphs: string[];
  action: { label: string; url: string };
  footnote?: string;
};

export function renderSimpleEmail(email: SimpleEmail): { text: string; html: string } {
  const text = [
    email.greeting,
    "",
    ...email.paragraphs.flatMap((p) => [p, ""]),
    `${email.action.label} : ${email.action.url}`,
    "",
    ...(email.footnote ? [email.footnote, ""] : []),
    `— ${email.companyName}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
      <tr><td>
        <p style="margin:0 0 24px;font-size:14px;color:#71717a;">${escapeHtml(email.companyName)}</p>
        <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(email.greeting)}</p>
        ${email.paragraphs
          .map(
            (p) =>
              `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(p)}</p>`,
          )
          .join("\n        ")}
        <p style="margin:24px 0;">
          <a href="${escapeHtml(email.action.url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:15px;">${escapeHtml(email.action.label)}</a>
        </p>
        <p style="margin:0 0 16px;font-size:13px;color:#71717a;line-height:1.5;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${escapeHtml(email.action.url)}</p>
        ${email.footnote ? `<p style="margin:0;font-size:13px;color:#71717a;">${escapeHtml(email.footnote)}</p>` : ""}
      </td></tr>
    </table>
  </body>
</html>`;

  return { text, html };
}
