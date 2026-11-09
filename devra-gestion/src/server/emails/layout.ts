/**
 * Mise en page commune des emails : en-tête avec le logo (ou le nom) de
 * l'entreprise, contenu sur une carte blanche, coordonnées en pied.
 *
 * HTML « email » : tableaux et styles en ligne uniquement, pour un rendu
 * identique dans Gmail, Outlook et Apple Mail. Toutes les informations de
 * l'entreprise viennent de Paramètres → Entreprise (voir branding.ts).
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Identité de l'entreprise dans les emails. */
export type EmailBranding = {
  /** Nom affiché en tête (si aucun logo) et dans le pied. */
  name: string;
  /** Lignes du pied : adresse, puis email · téléphone · site. */
  footer: string[];
  /** Logo joint à l'email et affiché par son Content-ID, à sa taille d'affichage. */
  logo: { cid: string; width: number; height: number } | null;
};

export const EMAIL_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export const EMAIL_COLORS = {
  page: "#f4f4f5",
  card: "#ffffff",
  text: "#27272a",
  muted: "#71717a",
  border: "#e4e4e7",
  panel: "#fafafa",
  accent: "#18181b",
};

const C = EMAIL_COLORS;

export function renderEmailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;">
  <tr><td style="border-radius:6px;background:${C.accent};">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 24px;font-family:${EMAIL_FONT};font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

export function renderEmailParagraph(html: string, options: { muted?: boolean } = {}): string {
  const style = options.muted
    ? `margin:0 0 16px;font-size:13px;line-height:1.6;color:${C.muted};`
    : `margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.text};`;
  return `<p style="${style}">${html}</p>`;
}

function header(branding: EmailBranding): string {
  const content = branding.logo
    ? `<img src="cid:${escapeHtml(branding.logo.cid)}" width="${branding.logo.width}" height="${branding.logo.height}" alt="${escapeHtml(branding.name)}" style="display:block;border:0;outline:none;width:${branding.logo.width}px;height:${branding.logo.height}px;">`
    : `<span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${C.accent};">${escapeHtml(branding.name)}</span>`;
  return `<tr><td style="padding:24px 28px;border-bottom:1px solid ${C.border};">${content}</td></tr>`;
}

function footer(branding: EmailBranding): string {
  const lines = [branding.name, ...branding.footer].filter(Boolean);
  if (lines.length === 0) return "";
  return `<tr><td style="padding:20px 28px 0;text-align:center;font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${C.muted};">
        ${lines.map((line, i) => (i === 0 ? `<strong style="color:${C.text};">${escapeHtml(line)}</strong>` : escapeHtml(line))).join("<br>")}
      </td></tr>`;
}

/** Document HTML complet : en-tête, contenu (déjà en HTML) et pied. */
export function renderEmailShell(input: {
  lang: "fr" | "de";
  title: string;
  /** Aperçu affiché après l'objet dans la liste des emails. */
  preheader: string;
  branding: EmailBranding;
  content: string;
}): string {
  return `<!doctype html>
<html lang="${input.lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${EMAIL_FONT};">
          <tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border:1px solid ${C.border};border-radius:10px;">
              ${header(input.branding)}
              <tr><td style="padding:28px 28px 12px;font-family:${EMAIL_FONT};color:${C.text};">
                ${input.content}
              </td></tr>
            </table>
          </td></tr>
          ${footer(input.branding)}
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export type SimpleEmail = {
  branding: EmailBranding;
  title: string;
  greeting: string;
  paragraphs: string[];
  action: { label: string; url: string };
  footnote?: string;
};

/**
 * Email simple (invitation, mot de passe, notification) : un texte, un bouton
 * et le lien en clair pour les messageries qui n'affichent pas le bouton.
 */
export function renderSimpleEmail(email: SimpleEmail): { text: string; html: string } {
  const text = [
    email.greeting,
    "",
    ...email.paragraphs.flatMap((p) => [p, ""]),
    `${email.action.label} : ${email.action.url}`,
    "",
    ...(email.footnote ? [email.footnote, ""] : []),
    `— ${email.branding.name}`,
  ].join("\n");

  const content = [
    renderEmailParagraph(escapeHtml(email.greeting)),
    ...email.paragraphs.map((p) => renderEmailParagraph(escapeHtml(p))),
    renderEmailButton(email.action.label, email.action.url),
    renderEmailParagraph(
      `Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${escapeHtml(email.action.url)}" style="color:${C.muted};word-break:break-all;">${escapeHtml(email.action.url)}</a>`,
      { muted: true },
    ),
    ...(email.footnote ? [renderEmailParagraph(escapeHtml(email.footnote), { muted: true })] : []),
  ].join("\n                ");

  const html = renderEmailShell({
    lang: "fr",
    title: email.title,
    preheader: email.paragraphs[0] ?? email.title,
    branding: email.branding,
    content,
  });
  return { text, html };
}
