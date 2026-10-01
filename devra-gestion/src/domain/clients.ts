/**
 * Règles métier des clients (pures, sans base de données).
 */
import { normalizeSearchText } from "@/domain/search";

export type ClientKind = "INDIVIDUAL" | "COMPANY";

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  INDIVIDUAL: "Particulier",
  COMPANY: "Entreprise",
};

export const LANGUAGE_LABELS = { FR: "Français", DE: "Allemand" } as const;
export type DocumentLanguage = keyof typeof LANGUAGE_LABELS;

/** Nom affiché : raison sociale pour une entreprise, « Prénom Nom » pour un particulier. */
export function clientDisplayName(client: {
  kind: ClientKind;
  firstName: string;
  lastName: string;
  companyName: string;
}): string {
  if (client.kind === "COMPANY") return client.companyName.trim();
  return [client.firstName.trim(), client.lastName.trim()].filter(Boolean).join(" ");
}

const NUMBER_PATTERN = String.raw`\d+\s?[a-zA-Z]?(?:\s?(?:bis|ter))?`;
const NUMBER_AT_END = new RegExp(String.raw`^(.*?\D)[\s,]+(${NUMBER_PATTERN})$`, "i");
const NUMBER_AT_START = new RegExp(String.raw`^(${NUMBER_PATTERN})[\s,]+(\D.*)$`, "i");

/**
 * Sépare la rue et le numéro d'une adresse saisie en une seule colonne :
 *   « Rue du Lac 12 »      → Rue du Lac / 12
 *   « Bahnhofstrasse 12a » → Bahnhofstrasse / 12a
 *   « 12 bis, rue du Lac » → rue du Lac / 12 bis
 * La QR-facture exige une adresse structurée (rue et numéro séparés).
 */
export function splitStreetAndNumber(value: string): { street: string; number: string } {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const end = trimmed.match(NUMBER_AT_END);
  if (end?.[1] && end[2]) return { street: end[1].trim().replace(/,$/, ""), number: end[2] };
  const start = trimmed.match(NUMBER_AT_START);
  if (start?.[1] && start[2]) return { street: start[2].trim(), number: start[1] };
  return { street: trimmed, number: "" };
}

export const TAG_MAX_LENGTH = 30;
export const TAGS_MAX_COUNT = 20;

/** Nettoie une liste d'étiquettes : espaces, doublons (sans tenir compte de la casse), vides. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, TAG_MAX_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result.slice(0, TAGS_MAX_COUNT);
}

/** Découpe une cellule « web, urgent; vip » en étiquettes. */
export function parseTagList(value: string): string[] {
  return normalizeTags(value.split(/[,;|]/));
}

/** Colonnes calculées enregistrées avec le client : clé de tri et texte de recherche. */
export function clientSearchColumns(client: {
  displayName: string;
  contactName: string;
  email: string;
  phone: string;
  postalCode: string;
  city: string;
  street: string;
  tags: string[];
}): { sortName: string; searchText: string } {
  const sortName = normalizeSearchText(client.displayName);
  const searchText = normalizeSearchText(
    [
      client.displayName,
      client.contactName,
      client.email,
      client.phone,
      client.phone.replace(/\D/g, ""),
      client.postalCode,
      client.city,
      client.street,
      ...client.tags,
    ].join(" "),
  );
  return { sortName, searchText };
}
