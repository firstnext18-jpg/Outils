import { describe, expect, it } from "vitest";
import { priceText, publicPriceList, type PriceListSource } from "@/domain/price-list";

const item = (overrides: Partial<PriceListSource>): PriceListSource => ({
  id: "id",
  name: "Site vitrine",
  nameDe: "",
  description: "",
  descriptionDe: "",
  category: "Sites internet",
  lineType: "FLAT",
  unit: "FLAT",
  unitPriceCents: 149000,
  periodicity: null,
  updatedAt: new Date("2026-11-01T10:00:00Z"),
  ...overrides,
});

describe("tarifs publics", () => {
  it("présente le prix selon l'unité ou la périodicité", () => {
    expect(priceText(item({}), "FR")).toBe("CHF 1'490.00");
    expect(priceText(item({ unit: "HOUR", unitPriceCents: 9000 }), "FR")).toBe("CHF 90.00 / h");
    expect(priceText(item({ unit: "PAGE", unitPriceCents: 15000 }), "DE")).toBe(
      "CHF 150.00 / Seite",
    );
    expect(
      priceText(item({ unit: "MONTH", unitPriceCents: 2900, periodicity: "MONTHLY" }), "FR"),
    ).toBe("CHF 29.00 par mois");
    expect(
      priceText(item({ unit: "YEAR", unitPriceCents: 2500, periodicity: "YEARLY" }), "DE"),
    ).toBe("CHF 25.00 pro Jahr");
  });

  it("groupe par catégorie, les prestations sans catégorie à la fin", () => {
    const list = publicPriceList({
      company: "Atelier Léman",
      vat: { enabled: false, rateBps: 810 },
      now: new Date("2026-11-11T12:00:00Z"),
      items: [
        item({ id: "a", category: "", name: "Conseil" }),
        item({
          id: "b",
          category: "Options",
          name: "Page supplémentaire",
          lineType: "EXTRA",
          unit: "PAGE",
          unitPriceCents: 15000,
        }),
        item({ id: "c", nameDe: "Website", updatedAt: new Date("2026-11-05T08:00:00Z") }),
      ],
    });
    expect(list.categories.map((c) => c.categorie)).toEqual(["Options", "Sites internet", null]);
    expect(list.nombrePrestations).toBe(3);
    expect(list.miseAJour).toBe("2026-11-05T08:00:00.000Z");
    expect(list.tva).toEqual({ assujettie: false, taux: null, prixHorsTva: false });
    expect(list.categories[1]!.prestations[0]).toMatchObject({
      nom: "Site vitrine",
      nomDe: "Website",
      prix: 1490,
      prixCentimes: 149000,
      prixTexte: "CHF 1'490.00",
      typeLibelle: "Forfait",
      uniteLibelle: "forfait",
      periodicite: null,
    });
    // Sans traduction, le nom allemand reprend le nom français.
    expect(list.categories[0]!.prestations[0]!.nomDe).toBe("Page supplémentaire");
  });

  it("indique la TVA quand l'entreprise y est assujettie", () => {
    const list = publicPriceList({
      company: "Atelier Léman",
      vat: { enabled: true, rateBps: 810 },
      now: new Date("2026-11-11T12:00:00Z"),
      items: [],
    });
    expect(list.tva).toEqual({ assujettie: true, taux: 8.1, prixHorsTva: true });
    expect(list.miseAJour).toBe("2026-11-11T12:00:00.000Z");
    expect(list.categories).toEqual([]);
  });
});
