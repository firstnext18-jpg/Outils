/**
 * Unités des lignes de devis et de factures, avec leur libellé sur les
 * documents en français et en allemand (singulier / pluriel).
 */
export const UNITS = ["FLAT", "HOUR", "PIECE", "PAGE", "DAY", "MONTH", "QUARTER", "YEAR"] as const;
export type UnitCode = (typeof UNITS)[number];

type Forms = { one: string; many: string };

export const UNIT_LABELS: Record<UnitCode, { name: string; FR: Forms; DE: Forms }> = {
  FLAT: {
    name: "Forfait",
    FR: { one: "forfait", many: "forfaits" },
    DE: { one: "Pauschale", many: "Pauschalen" },
  },
  HOUR: { name: "Heure", FR: { one: "h", many: "h" }, DE: { one: "Std.", many: "Std." } },
  PIECE: { name: "Pièce", FR: { one: "pce", many: "pces" }, DE: { one: "Stk.", many: "Stk." } },
  PAGE: { name: "Page", FR: { one: "page", many: "pages" }, DE: { one: "Seite", many: "Seiten" } },
  DAY: { name: "Jour", FR: { one: "jour", many: "jours" }, DE: { one: "Tag", many: "Tage" } },
  MONTH: { name: "Mois", FR: { one: "mois", many: "mois" }, DE: { one: "Monat", many: "Monate" } },
  QUARTER: {
    name: "Trimestre",
    FR: { one: "trimestre", many: "trimestres" },
    DE: { one: "Quartal", many: "Quartale" },
  },
  YEAR: { name: "Année", FR: { one: "an", many: "ans" }, DE: { one: "Jahr", many: "Jahre" } },
};

/**
 * Libellé de l'unité sur un document. `quantityMilli` est la quantité en
 * millièmes (1,5 h = 1500) : le pluriel s'applique à partir de 2.
 */
export function unitLabel(unit: UnitCode, language: "FR" | "DE", quantityMilli = 1000): string {
  const forms = UNIT_LABELS[unit][language];
  return quantityMilli >= 2000 ? forms.many : forms.one;
}
