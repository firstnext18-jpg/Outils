import { normalizeKey } from "@/domain/text";

/**
 * Les 26 cantons suisses : code officiel, nom en français et en allemand, et
 * autres appellations reconnues à l'import (italien, anglais, abréviations).
 */
export const CANTONS = [
  { code: "AG", fr: "Argovie", de: "Aargau", aliases: [] },
  {
    code: "AI",
    fr: "Appenzell Rhodes-Intérieures",
    de: "Appenzell Innerrhoden",
    aliases: ["Appenzell Innerrhoden", "Appenzell IR"],
  },
  {
    code: "AR",
    fr: "Appenzell Rhodes-Extérieures",
    de: "Appenzell Ausserrhoden",
    aliases: ["Appenzell AR"],
  },
  { code: "BE", fr: "Berne", de: "Bern", aliases: [] },
  { code: "BL", fr: "Bâle-Campagne", de: "Basel-Landschaft", aliases: ["Basel-Land", "Baselland"] },
  { code: "BS", fr: "Bâle-Ville", de: "Basel-Stadt", aliases: ["Basel", "Bâle"] },
  { code: "FR", fr: "Fribourg", de: "Freiburg", aliases: ["Friburgo"] },
  { code: "GE", fr: "Genève", de: "Genf", aliases: ["Geneva", "Ginevra"] },
  { code: "GL", fr: "Glaris", de: "Glarus", aliases: [] },
  { code: "GR", fr: "Grisons", de: "Graubünden", aliases: ["Grigioni", "Grischun"] },
  { code: "JU", fr: "Jura", de: "Jura", aliases: [] },
  { code: "LU", fr: "Lucerne", de: "Luzern", aliases: ["Lucerna"] },
  { code: "NE", fr: "Neuchâtel", de: "Neuenburg", aliases: [] },
  { code: "NW", fr: "Nidwald", de: "Nidwalden", aliases: [] },
  { code: "OW", fr: "Obwald", de: "Obwalden", aliases: [] },
  {
    code: "SG",
    fr: "Saint-Gall",
    de: "St. Gallen",
    aliases: ["Sankt Gallen", "St-Gall", "San Gallo"],
  },
  { code: "SH", fr: "Schaffhouse", de: "Schaffhausen", aliases: [] },
  { code: "SO", fr: "Soleure", de: "Solothurn", aliases: [] },
  { code: "SZ", fr: "Schwytz", de: "Schwyz", aliases: [] },
  { code: "TG", fr: "Thurgovie", de: "Thurgau", aliases: [] },
  { code: "TI", fr: "Tessin", de: "Tessin", aliases: ["Ticino"] },
  { code: "UR", fr: "Uri", de: "Uri", aliases: [] },
  { code: "VD", fr: "Vaud", de: "Waadt", aliases: [] },
  { code: "VS", fr: "Valais", de: "Wallis", aliases: ["Vallese"] },
  { code: "ZG", fr: "Zoug", de: "Zug", aliases: [] },
  { code: "ZH", fr: "Zurich", de: "Zürich", aliases: ["Zurigo"] },
] as const;

export type CantonCode = (typeof CANTONS)[number]["code"];

export const CANTON_CODES = CANTONS.map((c) => c.code) as [CantonCode, ...CantonCode[]];

/** Cantons triés par nom français (pour les listes déroulantes). */
export const CANTONS_BY_FR_NAME = [...CANTONS].sort((a, b) => a.fr.localeCompare(b.fr, "fr"));

export function cantonName(code: CantonCode, language: "FR" | "DE" = "FR"): string {
  const canton = CANTONS.find((c) => c.code === code);
  if (!canton) return code;
  return language === "DE" ? canton.de : canton.fr;
}

const LOOKUP = new Map<string, CantonCode>();
for (const canton of CANTONS) {
  for (const name of [canton.code, canton.fr, canton.de, ...canton.aliases]) {
    LOOKUP.set(normalizeKey(name), canton.code);
  }
}

/** Reconnaît un canton à partir de son code ou de son nom (FR, DE, IT, EN). */
export function parseCanton(value: string): CantonCode | null {
  const key = normalizeKey(value);
  return key ? (LOOKUP.get(key) ?? null) : null;
}
