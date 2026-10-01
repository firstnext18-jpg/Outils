import { describe, expect, it } from "vitest";
import { csvValue, exportPresets, plainAmount, rangeFileSuffix } from "@/domain/accounting";

describe("export comptable", () => {
  it("propose le mois, le trimestre et l'année précédents, et l'année en cours", () => {
    expect(exportPresets("2026-10-15")).toEqual([
      { label: "Mois dernier", range: { from: "2026-09-01", to: "2026-09-30" } },
      { label: "Trimestre dernier", range: { from: "2026-07-01", to: "2026-09-30" } },
      { label: "Année en cours", range: { from: "2026-01-01", to: "2026-10-15" } },
      { label: "Année dernière", range: { from: "2025-01-01", to: "2025-12-31" } },
    ]);
    // En janvier, le mois et le trimestre précédents sont dans l'année d'avant.
    const january = exportPresets("2027-01-05");
    expect(january[0]!.range).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(january[1]!.range).toEqual({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("écrit les montants sans séparateur de milliers", () => {
    expect(plainAmount(125_000)).toBe("1250.00");
    expect(plainAmount(5)).toBe("0.05");
    expect(plainAmount(-1_250)).toBe("-12.50");
    expect(plainAmount(0)).toBe("0.00");
  });

  it("formate chaque cellule selon le type de la colonne", () => {
    expect(csvValue({ header: "Total", type: "amount" }, 99_000)).toBe("990.00");
    expect(csvValue({ header: "Date", type: "date" }, "2026-03-31")).toBe("31.03.2026");
    expect(csvValue({ header: "Client", type: "text" }, "Café Lumière")).toBe("Café Lumière");
    expect(csvValue({ header: "Payé le", type: "date" }, null)).toBe("");
  });

  it("nomme les fichiers d'après la période", () => {
    expect(rangeFileSuffix({ from: "2026-01-01", to: "2026-03-31" })).toBe("2026-01-01_2026-03-31");
  });
});
