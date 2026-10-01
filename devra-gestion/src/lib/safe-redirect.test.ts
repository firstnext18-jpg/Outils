import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeRedirectPath("/devis?statut=envoye")).toBe("/devis?statut=envoye");
  });

  it("refuse une redirection vers un autre site", () => {
    expect(safeRedirectPath("https://exemple.com")).toBe("/");
    expect(safeRedirectPath("//exemple.com")).toBe("/");
    expect(safeRedirectPath("/\\exemple.com")).toBe("/");
  });

  it("revient à l'accueil sans valeur", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });
});
