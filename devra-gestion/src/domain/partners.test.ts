import { describe, expect, it } from "vitest";
import { formatChf } from "@/lib/format";
import {
  companyFunds,
  isIncoming,
  overdrawProblem,
  partnerBalance,
  signedCents,
} from "@/domain/partners";

describe("argent des associés", () => {
  const movements = [
    { kind: "CAPITAL_IN" as const, amountCents: 1_000_000 },
    { kind: "LOAN_IN" as const, amountCents: 500_000 },
    { kind: "LOAN_OUT" as const, amountCents: 200_000 },
    { kind: "CAPITAL_OUT" as const, amountCents: 100_000 },
  ];

  it("calcule capital, prêt restant, entrées et sorties", () => {
    expect(partnerBalance(movements)).toEqual({
      capitalCents: 900_000,
      loanCents: 300_000,
      inCents: 1_500_000,
      outCents: 300_000,
    });
    expect(partnerBalance([])).toEqual({ capitalCents: 0, loanCents: 0, inCents: 0, outCents: 0 });
  });

  it("donne le sens du point de vue de l'entreprise", () => {
    expect(isIncoming("LOAN_IN")).toBe(true);
    expect(isIncoming("LOAN_OUT")).toBe(false);
    expect(movements.map(signedCents).reduce((a, b) => a + b, 0)).toBe(1_200_000);
  });

  it("refuse de rendre plus que ce que l'associé a mis", () => {
    const balance = partnerBalance(movements);
    expect(
      overdrawProblem({ kind: "LOAN_OUT", amountCents: 300_000 }, balance, formatChf),
    ).toBeNull();
    expect(overdrawProblem({ kind: "LOAN_OUT", amountCents: 300_001 }, balance, formatChf)).toBe(
      "Le remboursement dépasse le prêt restant de cet associé (CHF 3'000.00).",
    );
    expect(
      overdrawProblem({ kind: "CAPITAL_OUT", amountCents: 1 }, partnerBalance([]), formatChf),
    ).toBe("Cet associé n'a pas de capital apporté à retirer.");
    expect(
      overdrawProblem({ kind: "CAPITAL_IN", amountCents: 1 }, partnerBalance([]), formatChf),
    ).toBeNull();
  });
});

describe("fonds de l'entreprise", () => {
  it("encaissé + apports − dépenses − rendu aux associés", () => {
    expect(
      companyFunds({
        paidCents: 1_250_000,
        partnerInCents: 700_000,
        expensesCents: 24_000,
        partnerOutCents: 50_000,
      }).totalCents,
    ).toBe(1_876_000);
  });
});
