import { describe, expect, it } from "vitest";
import de from "@/i18n/documents/de.json";
import fr from "@/i18n/documents/fr.json";
import { fillLabel } from "@/i18n/documents";

describe("traductions des documents", () => {
  it("le français et l'allemand ont exactement les mêmes clés", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(fr).sort());
  });

  it("aucun libellé n'est vide", () => {
    for (const labels of [fr, de]) {
      for (const [key, value] of Object.entries(labels)) expect(value, key).not.toBe("");
    }
  });

  it("remplace les variables", () => {
    expect(fillLabel(fr.page, { page: 1, pages: 3 })).toBe("Page 1 / 3");
    expect(fillLabel(de.page, { page: 2, pages: 2 })).toBe("Seite 2 / 2");
  });
});
