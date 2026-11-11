/**
 * Discussions entre les utilisateurs de l'outil : un canal général, et autant
 * de discussions que nécessaire sur chaque client (choix à faire, questions…).
 * Module pur : utilisable côté serveur comme côté client.
 */

/** Identifiant fixe du canal général (créé à la première consultation). */
export const GENERAL_DISCUSSION_ID = "general";
export const GENERAL_DISCUSSION_TITLE = "Général";

export const DISCUSSION_TITLE_MAX = 120;
export const MESSAGE_MAX = 5000;
/** Messages affichés d'emblée dans une discussion (les plus récents). */
export const MESSAGES_PAGE = 200;

export function isGeneralDiscussion(id: string): boolean {
  return id === GENERAL_DISCUSSION_ID;
}

/** Début d'un message sur une ligne, pour les listes et les notifications. */
export function messageExcerpt(body: string, max = 120): string {
  const line = body.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** Initiales d'un nom (« Léa Martin » → « LM »), pour les avatars. */
export function nameInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

const READERS_SHOWN = 6;
const nameList = new Intl.ListFormat("fr", { type: "conjunction" });

/**
 * Accusé de lecture d'un message, vu par son auteur : « Lu par Léa, Marc et
 * Rita », « Lu par Léa, … et 3 autres », ou « Pas encore lu ».
 */
export function readReceiptLabel(readers: string[]): string {
  if (readers.length === 0) return "Pas encore lu";
  if (readers.length <= READERS_SHOWN) return `Lu par ${nameList.format(readers)}`;
  const others = readers.length - READERS_SHOWN;
  return `Lu par ${readers.slice(0, READERS_SHOWN).join(", ")} et ${others} autre${others > 1 ? "s" : ""}`;
}

/** Morceaux d'un message : texte, ou adresse web à rendre cliquable. */
export function messageParts(body: string): { text: string; url?: string }[] {
  const parts: { text: string; url?: string }[] = [];
  let last = 0;
  for (const match of body.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    const url = match[0].replace(/[.,;:!?)]+$/, "");
    if (match.index > last) parts.push({ text: body.slice(last, match.index) });
    parts.push({ text: url, url });
    last = match.index + url.length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}
