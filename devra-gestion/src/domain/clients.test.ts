import { describe, expect, it } from "vitest";
import {
  clientDisplayName,
  normalizeTags,
  parseTagList,
  splitStreetAndNumber,
} from "@/domain/clients";

describe("clientDisplayName", () => {
  const base = { firstName: "Léa", lastName: "Muller", companyName: "Boulangerie du Lac" };

  it("particulier : prénom et nom", () => {
    expect(clientDisplayName({ kind: "INDIVIDUAL", ...base })).toBe("Léa Muller");
    expect(clientDisplayName({ kind: "INDIVIDUAL", ...base, firstName: " " })).toBe("Muller");
  });

  it("entreprise : raison sociale", () => {
    expect(clientDisplayName({ kind: "COMPANY", ...base })).toBe("Boulangerie du Lac");
  });
});

describe("splitStreetAndNumber", () => {
  it.each([
    ["Rue du Lac 12", "Rue du Lac", "12"],
    ["Bahnhofstrasse 12a", "Bahnhofstrasse", "12a"],
    ["Chemin des Vignes 3 bis", "Chemin des Vignes", "3 bis"],
    ["12 rue du Lac", "rue du Lac", "12"],
    ["12 bis, rue du Lac", "rue du Lac", "12 bis"],
    ["Rue du Lac, 12", "Rue du Lac", "12"],
    ["Place Saint-François", "Place Saint-François", ""],
    ["  Avenue   de la Gare 1  ", "Avenue de la Gare", "1"],
  ])("« %s » → %s / %s", (input, street, number) => {
    expect(splitStreetAndNumber(input)).toEqual({ street, number });
  });
});

describe("tags", () => {
  it("retire espaces, vides et doublons (sans tenir compte de la casse)", () => {
    expect(normalizeTags([" web ", "Web", "", "vip", "VIP ", "urgent"])).toEqual([
      "web",
      "vip",
      "urgent",
    ]);
  });

  it("découpe une cellule sur , ; ou |", () => {
    expect(parseTagList("web, vip;urgent | web")).toEqual(["web", "vip", "urgent"]);
    expect(parseTagList("")).toEqual([]);
  });
});
