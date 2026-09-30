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

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
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
