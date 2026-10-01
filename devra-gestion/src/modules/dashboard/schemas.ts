import { z } from "zod";
import {
  dashboardPeriod,
  periodStartOf,
  PERIOD_KINDS,
  type DashboardPeriod,
} from "@/domain/dashboard";
import { daysBetween, isValidIsoDate, type IsoDate } from "@/domain/dates";

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value) || undefined;

/** Paramètres de l'adresse : `?periode=annee`, `?periode=personnalise&du=…&au=…`. */
export const dashboardParamsSchema = z.object({
  periode: z.preprocess(first, z.enum(PERIOD_KINDS).optional()).catch(undefined),
  du: z.preprocess(first, z.string().refine(isValidIsoDate).optional()).catch(undefined),
  au: z.preprocess(first, z.string().refine(isValidIsoDate).optional()).catch(undefined),
});

/** Période personnalisée la plus longue acceptée (10 ans). */
const MAX_CUSTOM_DAYS = 3_660;

/**
 * Période demandée. Une période personnalisée sans dates commence au début du
 * mois ; des dates incohérentes renvoient au mois en cours, avec un message.
 */
export function periodFromParams(
  params: z.output<typeof dashboardParamsSchema>,
  today: IsoDate,
): { period: DashboardPeriod; error: string | null } {
  const kind = params.periode ?? "mois";
  if (kind !== "personnalise") return { period: dashboardPeriod(kind, today), error: null };
  const from = params.du ?? periodStartOf("mois", today);
  const to = params.au ?? today;
  const days = daysBetween(from, to);
  if (days < 0 || days >= MAX_CUSTOM_DAYS) {
    return {
      period: dashboardPeriod("mois", today),
      error:
        days < 0
          ? "La date de début doit précéder la date de fin : le mois en cours est affiché."
          : "Choisissez une période de 10 ans au plus : le mois en cours est affiché.",
    };
  }
  return { period: dashboardPeriod("personnalise", today, { from, to }), error: null };
}
