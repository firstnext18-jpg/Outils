import { describe, expect, it } from "vitest";
import { formatAmount, formatChf, formatDate, formatDateTime } from "@/lib/format";

describe("formatAmount / formatChf", () => {
  it("affiche les montants au format suisse", () => {
    expect(formatChf(125_000)).toBe("CHF 1'250.00");
    expect(formatChf(5)).toBe("CHF 0.05");
    expect(formatChf(0)).toBe("CHF 0.00");
    expect(formatAmount(123_456_789)).toBe("1'234'567.89");
    expect(formatAmount(99_999)).toBe("999.99");
  });

  it("gère les montants négatifs (notes de crédit, acomptes déduits)", () => {
    expect(formatChf(-150_050)).toBe("CHF -1'500.50");
  });

  it("refuse un montant qui n'est pas un entier en centimes", () => {
    expect(() => formatAmount(12.5)).toThrow();
  });
});

describe("formatDate", () => {
  it("affiche JJ.MM.AAAA", () => {
    expect(formatDate(new Date("2026-03-05T12:00:00Z"))).toBe("05.03.2026");
  });

  it("utilise le fuseau de Zurich (pas celui du serveur)", () => {
    // 31.12.2025 à 23:30 UTC = 01.01.2026 à 00:30 à Zurich.
    expect(formatDate(new Date("2025-12-31T23:30:00Z"))).toBe("01.01.2026");
  });

  it("affiche l'heure en 24 h", () => {
    expect(formatDateTime(new Date("2026-07-01T12:05:00Z"))).toBe("01.07.2026 14:05");
  });
});
