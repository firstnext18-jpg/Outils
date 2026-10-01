/**
 * Tableau de bord : périodes affichées et comparaisons.
 *
 * Mois, trimestre et année « en cours » vont du début de la période à
 * aujourd'hui ; ils sont comparés au même nombre de jours de la période
 * précédente (le 1er–15 octobre avec le 1er–15 septembre), pour qu'une
 * période à peine commencée ne paraisse pas en forte baisse. Une période
 * personnalisée est comparée à la période de même durée qui la précède.
 */
import { addDays, addMonths, daysBetween, formatIsoDate, type IsoDate } from "@/domain/dates";

export const PERIOD_KINDS = ["mois", "trimestre", "annee", "personnalise"] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  mois: "Mois",
  trimestre: "Trimestre",
  annee: "Année",
  personnalise: "Personnalisé",
};

/** Intervalle de dates, bornes comprises. */
export type DateRange = { from: IsoDate; to: IsoDate };

export type DashboardPeriod = {
  kind: PeriodKind;
  current: DateRange;
  previous: DateRange;
};

const PERIOD_MONTHS = { mois: 1, trimestre: 3, annee: 12 } as const;

/** Premier jour du mois, du trimestre ou de l'année qui contient `date`. */
export function periodStartOf(kind: keyof typeof PERIOD_MONTHS, date: IsoDate): IsoDate {
  const year = date.slice(0, 4);
  const month = Number(date.slice(5, 7));
  if (kind === "annee") return `${year}-01-01`;
  const first = kind === "trimestre" ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  return `${year}-${String(first).padStart(2, "0")}-01`;
}

/**
 * Période affichée et période de comparaison. `custom` n'est utilisé que pour
 * une période personnalisée (dates déjà validées : `from` ≤ `to`).
 */
export function dashboardPeriod(
  kind: PeriodKind,
  today: IsoDate,
  custom?: DateRange,
): DashboardPeriod {
  if (kind === "personnalise") {
    const range = custom ?? { from: today, to: today };
    const days = daysBetween(range.from, range.to) + 1;
    return {
      kind,
      current: range,
      previous: { from: addDays(range.from, -days), to: addDays(range.from, -1) },
    };
  }
  const months = PERIOD_MONTHS[kind];
  const from = periodStartOf(kind, today);
  return {
    kind,
    current: { from, to: today },
    // `addMonths` reste dans le mois visé : le 31 mars se compare au 28 février.
    previous: { from: addMonths(from, -months), to: addMonths(today, -months) },
  };
}

/** « du 01.10.2026 au 15.10.2026 », ou « le 01.10.2026 » (dans une phrase). */
export function describeRange(range: DateRange): string {
  return range.from === range.to
    ? `le ${formatIsoDate(range.from)}`
    : `du ${formatIsoDate(range.from)} au ${formatIsoDate(range.to)}`;
}

/** Les `count` derniers mois jusqu'à celui de `today` compris, du plus ancien au plus récent. */
export function lastMonths(today: IsoDate, count = 12): { month: string; range: DateRange }[] {
  const current = periodStartOf("mois", today);
  return Array.from({ length: count }, (_, i) => {
    const from = addMonths(current, i - count + 1);
    return { month: from.slice(0, 7), range: { from, to: addDays(addMonths(from, 1), -1) } };
  });
}

/** Évolution relative (0.25 = +25 %) ; `null` s'il n'y a rien à comparer. */
export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/** « +25 % », « −8 % », « ±0 % » (arrondi au pour cent). */
export function formatChange(change: number): string {
  const percent = Math.round(change * 100);
  if (percent === 0) return "±0 %";
  return `${percent > 0 ? "+" : "−"}${Math.abs(percent)} %`;
}

/** Taux de conversion des devis : acceptés ÷ envoyés ; `null` sans devis envoyé. */
export function conversionRate(sent: number, accepted: number): number | null {
  return sent > 0 ? accepted / sent : null;
}

/** « 33 % » */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}
