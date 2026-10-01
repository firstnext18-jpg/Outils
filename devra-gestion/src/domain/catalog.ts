/**
 * Catalogue de prestations : types de lignes, périodicités et unités permises.
 */
import { normalizeSearchText } from "@/domain/search";
import { UNIT_LABELS, type UnitCode } from "@/domain/units";

export const LINE_TYPES = ["FLAT", "HOURLY", "EXTRA", "SUBSCRIPTION"] as const;
export type LineTypeCode = (typeof LINE_TYPES)[number];

export const LINE_TYPE_LABELS: Record<LineTypeCode, string> = {
  FLAT: "Forfait",
  HOURLY: "Heure",
  EXTRA: "Supplément",
  SUBSCRIPTION: "Abonnement",
};

export const LINE_TYPE_DESCRIPTIONS: Record<LineTypeCode, string> = {
  FLAT: "Prix global, ex. « Site vitrine 5 pages »",
  HOURLY: "Prix à l'heure, la quantité est un nombre d'heures",
  EXTRA: "Option ajoutée, ex. « Page supplémentaire »",
  SUBSCRIPTION: "Facturé chaque mois, trimestre ou année",
};

export const PERIODICITIES = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;
export type PeriodicityCode = (typeof PERIODICITIES)[number];

export const PERIODICITY_LABELS: Record<PeriodicityCode, string> = {
  MONTHLY: "Mensuel",
  QUARTERLY: "Trimestriel",
  YEARLY: "Annuel",
};

/** Unité d'un abonnement : sa période. */
export const PERIODICITY_UNIT: Record<PeriodicityCode, UnitCode> = {
  MONTHLY: "MONTH",
  QUARTERLY: "QUARTER",
  YEARLY: "YEAR",
};

/** Unités proposées selon le type de ligne (la première est celle par défaut). */
export function allowedUnits(
  lineType: LineTypeCode,
  periodicity: PeriodicityCode | null,
): UnitCode[] {
  switch (lineType) {
    case "HOURLY":
      return ["HOUR"];
    case "SUBSCRIPTION":
      return [PERIODICITY_UNIT[periodicity ?? "MONTHLY"]];
    case "EXTRA":
      return ["PIECE", "PAGE", "FLAT", "DAY"];
    case "FLAT":
      return ["FLAT", "PAGE", "PIECE", "DAY"];
  }
}

export function defaultUnit(lineType: LineTypeCode, periodicity: PeriodicityCode | null): UnitCode {
  return allowedUnits(lineType, periodicity)[0]!;
}

/** Suffixe du prix affiché dans l'application : « / h », « / mois » (rien pour un forfait). */
export function priceSuffix(unit: UnitCode): string {
  return unit === "FLAT" ? "" : ` / ${UNIT_LABELS[unit].FR.one}`;
}

export function catalogSearchText(item: {
  name: string;
  nameDe: string;
  description: string;
  descriptionDe: string;
  category: string;
}): string {
  return normalizeSearchText(
    [item.name, item.nameDe, item.description, item.descriptionDe, item.category].join(" "),
  );
}
