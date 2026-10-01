import { describe, expect, it } from "vitest";
import {
  allocateProportionally,
  computeLine,
  computeTotals,
  depositAmount,
  discountAmount,
  type CalcLine,
} from "@/domain/totals";

const line = (overrides: Partial<CalcLine> = {}): CalcLine => ({
  lineType: "FLAT",
  periodicity: null,
  quantityMilli: 1000,
  unitPriceCents: 0,
  discount: null,
  vatRateBps: null,
  ...overrides,
});

const totals = (lines: CalcLine[], extra: Partial<Parameters<typeof computeTotals>[0]> = {}) =>
  computeTotals({ lines, globalDiscount: null, deposit: null, vatEnabled: false, ...extra });

describe("computeLine", () => {
  it("quantité × prix unitaire", () => {
    expect(computeLine(line({ quantityMilli: 3000, unitPriceCents: 15_000 }))).toEqual({
      grossCents: 45_000,
      discountCents: 0,
      netCents: 45_000,
    });
  });

  it("quantités décimales (heures) arrondies au centime, 0,5 vers le haut", () => {
    expect(computeLine(line({ quantityMilli: 1500, unitPriceCents: 9_000 })).netCents).toBe(13_500);
    expect(computeLine(line({ quantityMilli: 250, unitPriceCents: 9_000 })).netCents).toBe(2_250);
    // 1,333 h × 95.00 = 126.635 → 126.64
    expect(computeLine(line({ quantityMilli: 1333, unitPriceCents: 9_500 })).netCents).toBe(12_664);
    // 0,125 h × 0.10 = 0.0125 → 0.01
    expect(computeLine(line({ quantityMilli: 125, unitPriceCents: 10 })).netCents).toBe(1);
  });

  it("remise de ligne en % ou en CHF, jamais plus que la ligne", () => {
    const base = { quantityMilli: 1000, unitPriceCents: 149_000 };
    expect(computeLine(line({ ...base, discount: { type: "PERCENT", value: 1000 } }))).toEqual({
      grossCents: 149_000,
      discountCents: 14_900,
      netCents: 134_100,
    });
    expect(
      computeLine(line({ ...base, discount: { type: "AMOUNT", value: 10_000 } })).netCents,
    ).toBe(139_000);
    expect(
      computeLine(line({ ...base, discount: { type: "AMOUNT", value: 999_999 } })).netCents,
    ).toBe(0);
    expect(
      computeLine(line({ ...base, discount: { type: "PERCENT", value: 20_000 } })).netCents,
    ).toBe(0);
  });

  it("reste exact pour de très grands montants", () => {
    // 100 000 unités × CHF 10 000 000.00
    const result = computeLine(line({ quantityMilli: 100_000_000, unitPriceCents: 1_000_000_000 }));
    expect(result.netCents).toBe(100_000_000_000_000);
  });
});

describe("discountAmount", () => {
  it("rien sans remise ou sur une base nulle", () => {
    expect(discountAmount(10_000, null)).toBe(0);
    expect(discountAmount(0, { type: "PERCENT", value: 1000 })).toBe(0);
  });

  it("pourcentage arrondi au centime", () => {
    // 5 % de 17.91 = 0.8955 → 0.90
    expect(discountAmount(1_791, { type: "PERCENT", value: 500 })).toBe(90);
  });
});

describe("arrondi aux 5 centimes", () => {
  it.each([
    [10_002, 10_000, -2],
    [10_003, 10_005, 2],
    [10_007, 10_005, -2],
    [10_008, 10_010, 2],
    [10_005, 10_005, 0],
  ])("%i centimes → total %i (arrondi %i)", (cents, total, rounding) => {
    const result = totals([line({ unitPriceCents: cents })]);
    expect(result.oneTime.totalCents).toBe(total);
    expect(result.oneTime.roundingCents).toBe(rounding);
  });

  it("3 × 33.34 = 100.02 → total 100.00, arrondi -0.02", () => {
    const result = totals([line({ quantityMilli: 3000, unitPriceCents: 3_334 })]);
    expect(result.oneTime).toMatchObject({
      subtotalCents: 10_002,
      roundingCents: -2,
      totalCents: 10_000,
    });
  });
});

describe("remise globale", () => {
  it("se cumule avec les remises de ligne", () => {
    const result = totals(
      [
        line({ unitPriceCents: 149_000, discount: { type: "PERCENT", value: 1000 } }), // 1'341.00
        line({ lineType: "EXTRA", quantityMilli: 3000, unitPriceCents: 15_000 }), // 450.00
      ],
      { globalDiscount: { type: "PERCENT", value: 500 } },
    );
    // Sous-total 1'791.00 ; 5 % = 89.55 ; net 1'701.45
    expect(result.oneTime).toMatchObject({
      subtotalCents: 179_100,
      discountCents: 8_955,
      netCents: 170_145,
      totalCents: 170_145,
      roundingCents: 0,
    });
  });

  it("en CHF, plafonnée au sous-total", () => {
    const result = totals([line({ unitPriceCents: 50_000 })], {
      globalDiscount: { type: "AMOUNT", value: 80_000 },
    });
    expect(result.oneTime).toMatchObject({ discountCents: 50_000, totalCents: 0 });
  });

  it("ne s'applique pas aux abonnements", () => {
    const result = totals(
      [
        line({ unitPriceCents: 100_000 }),
        line({ lineType: "SUBSCRIPTION", periodicity: "MONTHLY", unitPriceCents: 2_900 }),
      ],
      { globalDiscount: { type: "PERCENT", value: 1000 } },
    );
    expect(result.oneTime.totalCents).toBe(90_000);
    expect(result.recurring[0]).toMatchObject({
      periodicity: "MONTHLY",
      discountCents: 0,
      totalCents: 2_900,
    });
  });
});

describe("abonnements : montants récurrents séparés", () => {
  it("regroupés par périodicité, dans l'ordre mensuel, trimestriel, annuel", () => {
    const result = totals([
      line({ lineType: "SUBSCRIPTION", periodicity: "YEARLY", unitPriceCents: 2_500 }),
      line({ unitPriceCents: 149_000 }),
      line({ lineType: "SUBSCRIPTION", periodicity: "MONTHLY", unitPriceCents: 2_900 }),
      line({
        lineType: "SUBSCRIPTION",
        periodicity: "MONTHLY",
        unitPriceCents: 1_000,
        discount: { type: "AMOUNT", value: 500 },
      }),
    ]);
    expect(result.oneTime.totalCents).toBe(149_000);
    expect(result.recurring.map((r) => [r.periodicity, r.totalCents])).toEqual([
      ["MONTHLY", 3_400],
      ["YEARLY", 2_500],
    ]);
  });

  it("un devis sans abonnement n'a aucun montant récurrent", () => {
    expect(totals([line({ unitPriceCents: 1_000 })]).recurring).toEqual([]);
  });
});

describe("acompte", () => {
  it("en % du total, arrondi aux 5 centimes", () => {
    expect(depositAmount(194_100, { type: "PERCENT", value: 3000 })).toBe(58_230);
    // 30 % de 1'940.10 = 582.03 → 582.05
    expect(depositAmount(194_010, { type: "PERCENT", value: 3000 })).toBe(58_205);
  });

  it("en CHF, arrondi aux 5 centimes et plafonné au total", () => {
    expect(depositAmount(194_100, { type: "AMOUNT", value: 50_000 })).toBe(50_000);
    expect(depositAmount(194_100, { type: "AMOUNT", value: 50_003 })).toBe(50_005);
    expect(depositAmount(10_000, { type: "AMOUNT", value: 50_000 })).toBe(10_000);
  });

  it("calculé sur le montant unique, pas sur les abonnements", () => {
    const result = totals(
      [
        line({ unitPriceCents: 100_000 }),
        line({ lineType: "SUBSCRIPTION", periodicity: "MONTHLY", unitPriceCents: 50_000 }),
      ],
      { deposit: { type: "PERCENT", value: 5000 } },
    );
    expect(result.depositCents).toBe(50_000);
  });

  it("aucun acompte sans montant unique", () => {
    expect(depositAmount(0, { type: "PERCENT", value: 3000 })).toBe(0);
  });
});

describe("TVA (quand elle est activée)", () => {
  it("désactivée : aucune TVA, même si les lignes ont un taux", () => {
    const result = totals([line({ unitPriceCents: 100_000, vatRateBps: 810 })]);
    expect(result.oneTime).toMatchObject({ vat: [], vatCents: 0, totalCents: 100_000 });
  });

  it("8,1 % sur CHF 1'000.00 = CHF 81.00", () => {
    const result = totals([line({ unitPriceCents: 100_000, vatRateBps: 810 })], {
      vatEnabled: true,
    });
    expect(result.oneTime).toMatchObject({
      netCents: 100_000,
      vat: [{ rateBps: 810, baseCents: 100_000, vatCents: 8_100 }],
      totalCents: 108_100,
    });
  });

  it("plusieurs taux : la remise globale est répartie au prorata", () => {
    const result = totals(
      [
        line({ unitPriceCents: 100_000, vatRateBps: 810 }),
        line({ unitPriceCents: 50_000, vatRateBps: 260 }),
      ],
      { vatEnabled: true, globalDiscount: { type: "AMOUNT", value: 15_000 } },
    );
    expect(result.oneTime.vat).toEqual([
      { rateBps: 810, baseCents: 90_000, vatCents: 7_290 },
      { rateBps: 260, baseCents: 45_000, vatCents: 1_170 },
    ]);
    expect(result.oneTime.totalCents).toBe(143_460);
  });

  it("le total est arrondi aux 5 centimes après la TVA", () => {
    // 8,1 % de 123.45 = 10.00 (9.99945) → 133.45
    const result = totals([line({ unitPriceCents: 12_345, vatRateBps: 810 })], {
      vatEnabled: true,
    });
    expect(result.oneTime).toMatchObject({ vatCents: 1_000, totalCents: 13_345, roundingCents: 0 });
    // 8,1 % de 10.01 = 0.81 → 10.82 → 10.80
    const small = totals([line({ unitPriceCents: 1_001, vatRateBps: 810 })], { vatEnabled: true });
    expect(small.oneTime).toMatchObject({ vatCents: 81, totalCents: 1_080, roundingCents: -2 });
  });
});

describe("allocateProportionally", () => {
  it("répartit sans perdre de centime", () => {
    expect(allocateProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateProportionally(1, [50, 50])).toEqual([1, 0]);
    expect(allocateProportionally(0, [10, 20])).toEqual([0, 0]);
    const shares = allocateProportionally(15_001, [90_001, 45_003, 7]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(15_001);
  });
});

describe("document vide", () => {
  it("tout vaut zéro", () => {
    expect(totals([])).toEqual({
      lines: [],
      oneTime: {
        subtotalCents: 0,
        discountCents: 0,
        netCents: 0,
        vat: [],
        vatCents: 0,
        roundingCents: 0,
        totalCents: 0,
      },
      recurring: [],
      depositCents: 0,
    });
  });
});
