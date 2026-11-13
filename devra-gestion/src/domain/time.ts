/**
 * Suivi du temps et avancement des projets.
 * Module pur : utilisable côté serveur comme côté client.
 */

/** Durée maximale d'une saisie (24 heures). */
export const MAX_ENTRY_MINUTES = 24 * 60;

/**
 * Durée saisie → minutes. Formats acceptés : « 1:30 », « 1h30 », « 1 h 30 »,
 * « 1.5 » ou « 1,5 » (heures), « 45 min », « 45m ». `null` si illisible.
 */
export function parseDuration(input: string): number | null {
  const value = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!value) return null;
  let minutes: number | null = null;
  let match: RegExpMatchArray | null;
  if ((match = value.match(/^(\d{1,2}):([0-5]\d)$/))) {
    minutes = Number(match[1]) * 60 + Number(match[2]);
  } else if ((match = value.match(/^(\d{1,2})h(?:([0-5]?\d)(?:min|m)?)?$/))) {
    minutes = Number(match[1]) * 60 + Number(match[2] ?? 0);
  } else if ((match = value.match(/^(\d{1,4})(?:min|m)$/))) {
    minutes = Number(match[1]);
  } else if ((match = value.match(/^(\d{1,2})(?:[.,](\d{1,2}))?$/))) {
    minutes = Math.round(Number(`${match[1]}.${match[2] ?? 0}`) * 60);
  }
  if (minutes === null || minutes <= 0 || minutes > MAX_ENTRY_MINUTES) return null;
  return minutes;
}

/** 90 → « 1 h 30 », 45 → « 45 min », 120 → « 2 h ». */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Durée pour un champ de saisie : 90 → « 1:30 ». */
export function durationInput(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Heures décimales pour une ligne de facture (quantité) : 90 → « 1.5 », 20 → « 0.333 ». */
export function hoursQuantity(minutes: number): string {
  return String(Math.round((minutes / 60) * 1000) / 1000);
}

/** Minutes écoulées depuis le démarrage du chronomètre (minute entamée comptée, 1 au moins). */
export function elapsedMinutes(startedAt: Date, now: Date = new Date()): number {
  return Math.min(
    MAX_ENTRY_MINUTES,
    Math.max(1, Math.ceil((now.getTime() - startedAt.getTime()) / 60_000)),
  );
}

/** Avancement d'un projet : étapes terminées sur le total. */
export function projectProgress(steps: { doneAt: Date | null }[]) {
  const total = steps.length;
  const done = steps.filter((s) => s.doneAt !== null).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export const PROJECT_STATUS_LABELS = {
  ACTIVE: "En cours",
  PAUSED: "En pause",
  DONE: "Terminé",
} as const;
export type ProjectStatus = keyof typeof PROJECT_STATUS_LABELS;
