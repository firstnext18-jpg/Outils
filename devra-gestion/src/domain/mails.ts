/**
 * Section Mail : règles des emails échangés avec les clients.
 * Module pur : utilisable côté serveur comme côté client.
 */

/** Adresse email comparable (minuscules, sans espaces). */
export function normalizeAddress(address: string | null | undefined): string {
  return (address ?? "").trim().toLowerCase();
}

/** « <abc@exemple.ch> » → « abc@exemple.ch ». */
export function bareMessageId(id: string | null | undefined): string {
  return (id ?? "").trim().replace(/^<+|>+$/g, "");
}

/** Objet d'une réponse : « Re: » ajouté une seule fois (Re, RE, AW, Réf déjà présents). */
export function replySubject(subject: string): string {
  const clean = subject.trim() || "(sans objet)";
  return /^(re|aw|réf|ref)\s*:/i.test(clean) ? clean : `Re: ${clean}`;
}

/** En-têtes d'une réponse : fil de la conversation (RFC 5322). */
export function replyHeaders(original: { messageId: string; references: string[] }) {
  const references = [...original.references, original.messageId].filter(Boolean).slice(-20);
  return { inReplyTo: original.messageId, references };
}

/** Lignes qui annoncent le message cité dans une réponse (FR, DE, EN, Outlook). */
const QUOTE_INTRO = [
  /^Le .{3,200}a écrit\s*:?$/,
  /^Am .{3,200}schrieb .{0,200}:?$/,
  /^On .{3,200}wrote\s*:?$/,
  /^-{2,}\s*(Message d'origine|Original Message|Ursprüngliche Nachricht)\s*-{2,}$/i,
  /^(De|From|Von)\s*:\s.+$/,
];

/**
 * Sépare la réponse du message cité en dessous (« Le … a écrit : », lignes
 * « > ») : la réponse s'affiche, le message cité se déplie à la demande.
 */
export function splitQuoted(text: string): { body: string; quoted: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex(
    (line, i) =>
      i > 0 &&
      (QUOTE_INTRO.some((pattern) => pattern.test(line.trim())) ||
        (line.startsWith(">") && lines.slice(i).every((l) => l.startsWith(">") || !l.trim()))),
  );
  if (start <= 0) return { body: text.trim(), quoted: "" };
  const body = lines.slice(0, start).join("\n").trim();
  if (!body) return { body: text.trim(), quoted: "" };
  return { body, quoted: lines.slice(start).join("\n").trim() };
}

/** Début du message pour la liste des conversations. */
export function mailExcerpt(text: string, length = 140): string {
  const flat = splitQuoted(text).body.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}
