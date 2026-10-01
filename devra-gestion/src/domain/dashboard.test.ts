import { describe, expect, it } from "vitest";
import { zurichMidnight } from "@/domain/dates";
import {
  conversionRate,
  dashboardPeriod,
  describeRange,
  formatChange,
  formatRate,
  lastMonths,
  periodStartOf,
  relativeChange,
} from "@/domain/dashboard";

describe("périodes du tableau de bord", () => {
  it("trouve le début du mois, du trimestre et de l'année", () => {
    expect(periodStartOf("mois", "2026-10-15")).toBe("2026-10-01");
    expect(periodStartOf("trimestre", "2026-10-15")).toBe("2026-10-01");
    expect(periodStartOf("trimestre", "2026-09-30")).toBe("2026-07-01");
    expect(periodStartOf("trimestre", "2026-01-01")).toBe("2026-01-01");
    expect(periodStartOf("annee", "2026-10-15")).toBe("2026-01-01");
  });

  it("compare le mois en cours aux mêmes jours du mois précédent", () => {
    expect(dashboardPeriod("mois", "2026-10-15")).toEqual({
      kind: "mois",
      current: { from: "2026-10-01", to: "2026-10-15" },
      previous: { from: "2026-09-01", to: "2026-09-15" },
    });
    // Le 31 mars se compare à tout février.
    expect(dashboardPeriod("mois", "2026-03-31").previous).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    // Janvier se compare à décembre de l'année précédente.
    expect(dashboardPeriod("mois", "2027-01-10").previous).toEqual({
      from: "2026-12-01",
      to: "2026-12-10",
    });
  });

  it("compare le trimestre et l'année en cours à la même durée de la période précédente", () => {
    expect(dashboardPeriod("trimestre", "2026-11-20")).toMatchObject({
      current: { from: "2026-10-01", to: "2026-11-20" },
      previous: { from: "2026-07-01", to: "2026-08-20" },
    });
    expect(dashboardPeriod("annee", "2026-10-01")).toMatchObject({
      current: { from: "2026-01-01", to: "2026-10-01" },
      previous: { from: "2025-01-01", to: "2025-10-01" },
    });
    // Année bissextile : le 29 février se compare au 28 février.
    expect(dashboardPeriod("annee", "2028-02-29").previous.to).toBe("2027-02-28");
  });

  it("compare une période personnalisée à la période de même durée qui la précède", () => {
    expect(
      dashboardPeriod("personnalise", "2026-10-01", { from: "2026-03-01", to: "2026-03-31" }),
    ).toEqual({
      kind: "personnalise",
      current: { from: "2026-03-01", to: "2026-03-31" },
      previous: { from: "2026-01-29", to: "2026-02-28" },
    });
    expect(
      dashboardPeriod("personnalise", "2026-10-01", { from: "2026-05-04", to: "2026-05-04" })
        .previous,
    ).toEqual({ from: "2026-05-03", to: "2026-05-03" });
  });

  it("trouve l'instant de minuit à Zurich, heure d'été comprise", () => {
    expect(zurichMidnight("2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(zurichMidnight("2026-10-01").toISOString()).toBe("2026-09-30T22:00:00.000Z");
    // Jours de changement d'heure : minuit est encore à l'heure de la veille.
    expect(zurichMidnight("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(zurichMidnight("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });

  it("affiche une période au format suisse", () => {
    expect(describeRange({ from: "2026-10-01", to: "2026-10-15" })).toBe(
      "du 01.10.2026 au 15.10.2026",
    );
    expect(describeRange({ from: "2026-10-01", to: "2026-10-01" })).toBe("le 01.10.2026");
  });

  it("liste les 12 derniers mois, du plus ancien au mois en cours", () => {
    const months = lastMonths("2026-10-15");
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({
      month: "2025-11",
      range: { from: "2025-11-01", to: "2025-11-30" },
    });
    expect(months[3]!.range).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(months[11]).toEqual({
      month: "2026-10",
      range: { from: "2026-10-01", to: "2026-10-31" },
    });
  });
});

describe("indicateurs", () => {
  it("calcule et affiche l'évolution par rapport à la période précédente", () => {
    expect(relativeChange(125_00, 100_00)).toBe(0.25);
    expect(relativeChange(0, 100_00)).toBe(-1);
    expect(relativeChange(100_00, 0)).toBeNull();
    expect(formatChange(0.25)).toBe("+25 %");
    expect(formatChange(-0.084)).toBe("−8 %");
    expect(formatChange(0.004)).toBe("±0 %");
  });

  it("calcule le taux de conversion des devis", () => {
    expect(conversionRate(3, 1)).toBeCloseTo(1 / 3);
    expect(formatRate(1 / 3)).toBe("33 %");
    expect(conversionRate(0, 0)).toBeNull();
  });
});
