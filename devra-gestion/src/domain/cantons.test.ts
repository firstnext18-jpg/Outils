import { describe, expect, it } from "vitest";
import { CANTONS, cantonName, parseCanton } from "@/domain/cantons";

describe("cantons", () => {
  it("contient les 26 cantons", () => {
    expect(CANTONS).toHaveLength(26);
    expect(new Set(CANTONS.map((c) => c.code)).size).toBe(26);
  });

  it("donne le nom en français ou en allemand", () => {
    expect(cantonName("VD")).toBe("Vaud");
    expect(cantonName("VD", "DE")).toBe("Waadt");
    expect(cantonName("GR", "DE")).toBe("Graubünden");
  });
});

describe("parseCanton", () => {
  it("reconnaît les codes, quelle que soit la casse", () => {
    expect(parseCanton("vd")).toBe("VD");
    expect(parseCanton(" ZH ")).toBe("ZH");
  });

  it("reconnaît les noms en français, allemand, italien et anglais, avec ou sans accents", () => {
    expect(parseCanton("Genève")).toBe("GE");
    expect(parseCanton("geneve")).toBe("GE");
    expect(parseCanton("Genf")).toBe("GE");
    expect(parseCanton("Geneva")).toBe("GE");
    expect(parseCanton("Ticino")).toBe("TI");
    expect(parseCanton("Zürich")).toBe("ZH");
    expect(parseCanton("Saint-Gall")).toBe("SG");
    expect(parseCanton("St. Gallen")).toBe("SG");
    expect(parseCanton("Bâle-Campagne")).toBe("BL");
    expect(parseCanton("Wallis")).toBe("VS");
  });

  it("renvoie null pour une valeur inconnue ou ambiguë", () => {
    expect(parseCanton("Appenzell")).toBeNull();
    expect(parseCanton("Savoie")).toBeNull();
    expect(parseCanton("")).toBeNull();
  });
});
