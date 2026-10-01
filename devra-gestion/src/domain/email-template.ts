/**
 * Modèles d'emails (devis, factures) : texte libre avec des variables entre
 * accolades, remplacées à l'envoi.
 *
 *   {client}     nom du client (personne de contact pour une entreprise, si renseignée)
 *   {numero}     numéro du document
 *   {montant}    montant (devis : total ; facture : montant à payer)
 *   {echeance}   date (devis : fin de validité ; facture : échéance ; relance : nouveau délai)
 *   {date}       date du document (devis, facture)
 *   {lien}       lien d'acceptation en ligne du devis (option de la phase 9 ; vide sinon)
 *   {entreprise} nom de l'entreprise (Paramètres → Entreprise)
 */

export const EMAIL_VARIABLES = [
  "client",
  "numero",
  "montant",
  "echeance",
  "date",
  "lien",
  "entreprise",
] as const;
export type EmailVariable = (typeof EMAIL_VARIABLES)[number];
export type EmailValues = Partial<Record<EmailVariable, string>>;

export const EMAIL_VARIABLE_DESCRIPTIONS: Record<EmailVariable, string> = {
  client: "nom du client (personne de contact pour une entreprise, si renseignée)",
  numero: "numéro du devis ou de la facture",
  montant:
    "montant du devis, montant de la facture, ou montant à payer d'une relance (frais compris)",
  echeance: "fin de validité du devis, échéance de la facture, ou nouveau délai d'une relance",
  date: "date du devis ou de la facture",
  lien: "lien d'acceptation en ligne du devis (vide tant que l'option n'est pas activée)",
  entreprise: "nom de l'entreprise",
};

const VARIABLE = /\{([a-z]+)\}/g;

/**
 * Remplace les variables connues dont la valeur est fournie ; les autres
 * restent telles quelles (ex. {numero} d'une facture pas encore émise,
 * remplacé au moment de l'envoi).
 */
export function renderTemplate(template: string, values: EmailValues): string {
  return template.replace(VARIABLE, (match, name: string) => {
    const value = values[name as EmailVariable];
    return value === undefined ? match : value;
  });
}

/** Variables entre accolades qui n'existent pas (fautes de frappe dans un modèle). */
export function unknownVariables(template: string): string[] {
  // Plus large que VARIABLE : repère aussi {numéro} (accent) ou {Client} (majuscule).
  const names = [...template.matchAll(/\{([\p{L}_]+)\}/gu)].map((m) => m[1]!);
  return [...new Set(names.filter((n) => !(EMAIL_VARIABLES as readonly string[]).includes(n)))];
}

export const MAX_RECIPIENTS = 5;
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/**
 * Destinataires saisis (séparés par des virgules, points-virgules ou espaces)
 * → liste d'adresses en minuscules, sans doublon.
 */
export function parseRecipients(input: string): { emails: string[] } | { error: string } {
  const parts = input
    .split(/[\s,;]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return { error: "Indiquez au moins un destinataire" };
  const invalid = parts.find((p) => !EMAIL.test(p));
  if (invalid) return { error: `Adresse email invalide : ${invalid}` };
  const emails = [...new Set(parts)];
  if (emails.length > MAX_RECIPIENTS) {
    return { error: `${MAX_RECIPIENTS} destinataires au maximum` };
  }
  return { emails };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Texte saisi → paragraphes HTML (ligne vide = nouveau paragraphe, retour à la ligne = <br>). */
export function textToHtmlParagraphs(text: string): string[] {
  return text
    .replaceAll("\r\n", "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => escapeHtml(p).replaceAll("\n", "<br>"));
}
