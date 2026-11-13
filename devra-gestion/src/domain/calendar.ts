/**
 * Calendrier : échéances des factures, validité des devis, prochaines
 * facturations d'abonnement, échéances des projets, renouvellements des sites.
 * Module pur : utilisable côté serveur comme côté client.
 */
import { addDays } from "@/domain/dates";

export const CALENDAR_KINDS = [
  "invoice",
  "quote",
  "subscription",
  "project",
  "domain",
  "hosting",
  "ssl",
] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];

export const CALENDAR_KIND_LABELS: Record<CalendarKind, string> = {
  invoice: "Échéance de facture",
  quote: "Fin de validité d'un devis",
  subscription: "Facturation d'abonnement",
  project: "Échéance de projet",
  domain: "Expiration de domaine",
  hosting: "Renouvellement d'hébergement",
  ssl: "Expiration de certificat",
};

export type CalendarItem = {
  /** Identifiant stable, ex. « facture-<id> ». */
  uid: string;
  kind: CalendarKind;
  date: string;
  title: string;
  detail: string;
  href: string;
};

/** « 2026-11 » → premier jour du mois, ou `null` si invalide. */
export function parseMonth(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100 ? `${value}-01` : null;
}

export function shiftMonth(firstDay: string, months: number): string {
  const [year, month] = firstDay.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return date.toISOString().slice(0, 10);
}

/**
 * Jours affichés pour un mois : semaines complètes, du lundi au dimanche
 * (quelques jours du mois précédent et du suivant).
 */
export function monthGrid(firstDay: string): string[] {
  const first = new Date(`${firstDay}T00:00:00Z`);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = addDays(firstDay, -mondayOffset);
  const last = addDays(shiftMonth(firstDay, 1), -1);
  const lastDate = new Date(`${last}T00:00:00Z`);
  const end = addDays(last, (7 - ((lastDate.getUTCDay() + 6) % 7) - 1) % 7);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}
