import { describe, expect, it } from "vitest";
import { vatIncluded } from "@/domain/expenses";

describe("TVA contenue dans une dépense", () => {
  it("se déduit du montant TTC", () => {
    expect(vatIncluded(10810, 810)).toBe(810);
    expect(vatIncluded(10000, null)).toBe(0);
    expect(vatIncluded(5000, 260)).toBe(127);
  });
});
