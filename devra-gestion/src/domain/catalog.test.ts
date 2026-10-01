import { describe, expect, it } from "vitest";
import { allowedUnits, defaultUnit, priceSuffix } from "@/domain/catalog";
import { unitLabel } from "@/domain/units";

describe("unités selon le type de ligne", () => {
  it("heure → uniquement des heures", () => {
    expect(allowedUnits("HOURLY", null)).toEqual(["HOUR"]);
  });

  it("abonnement → l'unité suit la périodicité", () => {
    expect(defaultUnit("SUBSCRIPTION", "MONTHLY")).toBe("MONTH");
    expect(defaultUnit("SUBSCRIPTION", "QUARTERLY")).toBe("QUARTER");
    expect(allowedUnits("SUBSCRIPTION", "YEARLY")).toEqual(["YEAR"]);
  });

  it("forfait et supplément → forfait, page, pièce ou jour", () => {
    expect(defaultUnit("FLAT", null)).toBe("FLAT");
    expect(defaultUnit("EXTRA", null)).toBe("PIECE");
    expect(allowedUnits("EXTRA", null)).toContain("PAGE");
    expect(allowedUnits("FLAT", null)).not.toContain("MONTH");
  });
});

describe("libellés", () => {
  it("suffixe de prix dans l'application", () => {
    expect(priceSuffix("HOUR")).toBe(" / h");
    expect(priceSuffix("MONTH")).toBe(" / mois");
    expect(priceSuffix("FLAT")).toBe("");
  });

  it("unités traduites, au singulier et au pluriel", () => {
    expect(unitLabel("PAGE", "FR", 1000)).toBe("page");
    expect(unitLabel("PAGE", "FR", 3000)).toBe("pages");
    expect(unitLabel("PAGE", "DE", 3000)).toBe("Seiten");
    expect(unitLabel("HOUR", "DE", 1500)).toBe("Std.");
    expect(unitLabel("FLAT", "DE")).toBe("Pauschale");
  });
});
