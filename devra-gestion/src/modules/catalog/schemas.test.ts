import { describe, expect, it } from "vitest";
import { catalogItemInputSchema, EMPTY_CATALOG_ITEM } from "@/modules/catalog/schemas";

const valid = { ...EMPTY_CATALOG_ITEM, name: "Site vitrine", unitPrice: "1'490.00" };

describe("catalogItemInputSchema", () => {
  it("convertit le prix en centimes", () => {
    expect(catalogItemInputSchema.parse(valid)).toMatchObject({
      name: "Site vitrine",
      unitPriceCents: 149_000,
    });
  });

  it("refuse un prix illisible ou un nom vide", () => {
    const result = catalogItemInputSchema.safeParse({ ...valid, name: " ", unitPrice: "beaucoup" });
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(["name", "unitPrice"]);
  });

  it("exige la périodicité d'un abonnement et vérifie l'unité", () => {
    const noPeriod = catalogItemInputSchema.safeParse({
      ...valid,
      lineType: "SUBSCRIPTION",
      unit: "MONTH",
    });
    expect(noPeriod.error?.issues[0]?.path).toEqual(["periodicity"]);

    const wrongUnit = catalogItemInputSchema.safeParse({
      ...valid,
      lineType: "SUBSCRIPTION",
      periodicity: "YEARLY",
      unit: "MONTH",
    });
    expect(wrongUnit.error?.issues[0]?.path).toEqual(["unit"]);

    expect(
      catalogItemInputSchema.parse({
        ...valid,
        lineType: "SUBSCRIPTION",
        periodicity: "YEARLY",
        unit: "YEAR",
      }),
    ).toMatchObject({ periodicity: "YEARLY", unit: "YEAR" });
  });

  it("ignore la périodicité d'une ligne qui n'est pas un abonnement", () => {
    expect(
      catalogItemInputSchema.parse({ ...valid, periodicity: "MONTHLY" }).periodicity,
    ).toBeNull();
  });

  it("une prestation horaire se facture à l'heure", () => {
    expect(
      catalogItemInputSchema.safeParse({ ...valid, lineType: "HOURLY", unit: "FLAT" }).success,
    ).toBe(false);
    expect(
      catalogItemInputSchema.safeParse({ ...valid, lineType: "HOURLY", unit: "HOUR" }).success,
    ).toBe(true);
  });
});
