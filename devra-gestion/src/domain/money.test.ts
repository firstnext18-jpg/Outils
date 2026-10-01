import { describe, expect, it } from "vitest";
import { parseChfInput } from "@/domain/money";

describe("parseChfInput", () => {
  it.each([
    ["1490", 149_000],
    ["1'490.00", 149_000],
    ["1’490.50", 149_050],
    ["1 490,5", 149_050],
    ["CHF 90", 9_000],
    ["90 CHF", 9_000],
    ["0.05", 5],
    ["12.3", 1_230],
    ["1.250,50", 125_050],
    ["1,250.50", 125_050],
    ["1,250", 125_000],
    ["1,5", 150],
    ["0", 0],
  ])("« %s » → %i centimes", (input, cents) => {
    expect(parseChfInput(input)).toBe(cents);
  });

  it.each(["", "abc", "12.345", "-10", "1.2.3", "12,34,56", "1e3"])("refuse « %s »", (input) => {
    expect(parseChfInput(input)).toBeNull();
  });
});
