/**
 * Dates « calendaires » des documents (date du devis, validité, échéance),
 * manipulées sous forme de texte ISO « AAAA-MM-JJ » : pas d'heure, donc pas de
 * décalage de fuseau horaire. « Aujourd'hui » s'entend à Zurich.
 * En base, elles sont stockées en colonnes DATE (minuit UTC côté JavaScript).
 */

export type IsoDate = string;

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const match = value.match(ISO_PATTERN);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Date du jour à Zurich (et non celle du serveur, qui peut être en UTC). */
export function todayIso(now: Date = new Date()): IsoDate {
  return now.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** Ajoute des mois en restant dans le mois visé : 31.01 + 1 mois = 28.02 (29.02 en année bissextile). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Instant de minuit à Zurich le jour `date` : borne d'une recherche sur une
 * colonne horodatée (ex. date d'envoi d'un devis) pour une journée suisse.
 */
export function zurichMidnight(date: IsoDate): Date {
  const utc = Date.parse(`${date}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Heure affichée à Zurich à minuit UTC : l'écart est le décalage horaire du jour.
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(utc - (wall - utc));
}

/** Valeur à enregistrer dans une colonne DATE (Prisma). */
export function isoToDbDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Valeur lue dans une colonne DATE (Prisma renvoie minuit UTC). */
export function dbDateToIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4));
}

/** « 2026-09-30 » → « 30.09.2026 » */
export function formatIsoDate(date: IsoDate): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}
