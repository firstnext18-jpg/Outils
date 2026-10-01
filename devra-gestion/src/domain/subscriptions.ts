/**
 * Abonnements : périodes de facturation et revenu récurrent.
 *
 * Un abonnement est facturé d'avance, au début de chaque période. Les périodes
 * sont ancrées sur la date de début : un abonnement mensuel commencé le 31
 * janvier est facturé le 28 (ou 29) février, puis le 31 mars. La tâche
 * quotidienne rattrape les périodes manquées (Raspberry Pi éteint quelques
 * jours) sans jamais facturer deux fois la même période.
 */
import type { PeriodicityCode } from "@/domain/catalog";
import { addDays, type IsoDate } from "@/domain/dates";
import { divideRounded } from "@/domain/money";

export const SUBSCRIPTION_STATUSES = ["ACTIVE", "PAUSED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Actif",
  PAUSED: "En pause",
  CANCELLED: "Résilié",
};

export const PERIOD_MONTHS: Record<PeriodicityCode, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

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

/** Début de la période n° `index` (0 = la première). */
export function periodStart(startDate: IsoDate, periodicity: PeriodicityCode, index: number) {
  return addMonths(startDate, index * PERIOD_MONTHS[periodicity]);
}

/** Dernier jour de la période n° `index` (la veille du début de la suivante). */
export function periodEnd(startDate: IsoDate, periodicity: PeriodicityCode, index: number) {
  return addDays(periodStart(startDate, periodicity, index + 1), -1);
}

export type Period = { index: number; start: IsoDate; end: IsoDate };

/**
 * Périodes à facturer aujourd'hui : celles qui ont commencé (début ≤ aujourd'hui)
 * et ne sont pas encore facturées (index ≥ `billedPeriods`). Plafonné pour
 * qu'une date de début très ancienne ne génère pas des centaines de factures.
 */
export function duePeriods(
  subscription: { startDate: IsoDate; periodicity: PeriodicityCode; billedPeriods: number },
  today: IsoDate,
  max = 12,
): Period[] {
  const periods: Period[] = [];
  for (let index = subscription.billedPeriods; periods.length < max; index++) {
    const start = periodStart(subscription.startDate, subscription.periodicity, index);
    if (start > today) break;
    periods.push({
      index,
      start,
      end: periodEnd(subscription.startDate, subscription.periodicity, index),
    });
  }
  return periods;
}

/**
 * Reprise après une pause : les périodes écoulées pendant la pause ne sont pas
 * facturées ; on reprend à la première période qui commence aujourd'hui ou après.
 */
export function indexAfterPause(
  subscription: { startDate: IsoDate; periodicity: PeriodicityCode; billedPeriods: number },
  today: IsoDate,
): number {
  let index = subscription.billedPeriods;
  while (periodStart(subscription.startDate, subscription.periodicity, index) < today) index++;
  return index;
}

/**
 * Revenu récurrent des abonnements actifs, en centimes :
 * MRR (mensuel) = mensuels + trimestriels ÷ 3 + annuels ÷ 12 ; ARR (annuel) = MRR exact × 12.
 */
export function recurringRevenue(
  subscriptions: {
    status: SubscriptionStatus;
    periodicity: PeriodicityCode;
    amountCents: number;
  }[],
) {
  let yearly = 0;
  for (const s of subscriptions) {
    if (s.status !== "ACTIVE") continue;
    yearly += s.amountCents * (12 / PERIOD_MONTHS[s.periodicity]);
  }
  return { mrrCents: divideRounded(BigInt(yearly), 12n), arrCents: yearly };
}
