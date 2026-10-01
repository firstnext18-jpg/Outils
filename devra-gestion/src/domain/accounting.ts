/**
 * Export comptable : périodes proposées et formats des valeurs dans les
 * tableurs (montants « 1250.00 » et dates « JJ.MM.AAAA », lus comme des
 * nombres et des dates par Excel en Suisse).
 */
import type { DateRange } from "@/domain/dashboard";
import { periodStartOf } from "@/domain/dashboard";
import { addDays, addMonths, formatIsoDate, type IsoDate } from "@/domain/dates";

/** Périodes proposées en un clic sur la page d'export. */
export function exportPresets(today: IsoDate): { label: string; range: DateRange }[] {
  const month = periodStartOf("mois", today);
  const quarter = periodStartOf("trimestre", today);
  const year = periodStartOf("annee", today);
  const lastYear = addMonths(year, -12);
  return [
    { label: "Mois dernier", range: { from: addMonths(month, -1), to: addDays(month, -1) } },
    {
      label: "Trimestre dernier",
      range: { from: addMonths(quarter, -3), to: addDays(quarter, -1) },
    },
    { label: "Année en cours", range: { from: year, to: today } },
    { label: "Année dernière", range: { from: lastYear, to: addDays(year, -1) } },
  ];
}

/** Centimes → « 1250.00 » (sans séparateur de milliers : reconnu comme un nombre). */
export function plainAmount(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Colonne d'un export : texte, montant (centimes) ou date (AAAA-MM-JJ). */
export type ExportColumn = { header: string; type: "text" | "amount" | "date" };
export type ExportValue = string | number | null;

/** Valeur d'une cellule CSV selon le type de sa colonne. */
export function csvValue(column: ExportColumn, value: ExportValue): string {
  if (value === null || value === "") return "";
  if (column.type === "amount" && typeof value === "number") return plainAmount(value);
  if (column.type === "date" && typeof value === "string") return formatIsoDate(value);
  return String(value);
}

/** « 2026-01-01_2026-03-31 » : suffixe des noms de fichiers exportés. */
export function rangeFileSuffix(range: DateRange): string {
  return `${range.from}_${range.to}`;
}
