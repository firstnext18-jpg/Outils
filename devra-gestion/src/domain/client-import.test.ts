import { describe, expect, it } from "vitest";
import { guessMapping, mapImportRow } from "@/domain/client-import";

const SITE_TYPES = [
  { id: "01900000-0000-7000-8000-000000000001", name: "Vitrine" },
  { id: "01900000-0000-7000-8000-000000000002", name: "E-commerce" },
];

describe("guessMapping", () => {
  it("reconnaît des en-têtes en français, allemand et anglais", () => {
    expect(
      guessMapping([
        "Prénom",
        "Nom",
        "E-mail",
        "Adresse",
        "PLZ",
        "Ort",
        "Kanton",
        "Téléphone",
        "Bemerkungen",
      ]),
    ).toEqual({
      firstName: 0,
      lastName: 1,
      email: 2,
      street: 3,
      postalCode: 4,
      city: 5,
      canton: 6,
      phone: 7,
      notes: 8,
    });
  });

  it("reconnaît les en-têtes de notre propre export (aller-retour)", () => {
    const headers = [
      "Type",
      "Nom affiché",
      "Prénom",
      "Nom",
      "Raison sociale",
      "Personne de contact",
      "Rue",
      "Numéro",
      "NPA",
      "Localité",
      "Canton",
      "Pays",
      "Email",
      "Téléphone",
      "Site internet",
      "Type de site",
      "Langue",
      "Tags",
      "Notes",
      "Archivé",
      "Créé le",
    ];
    const mapping = guessMapping(headers);
    expect(mapping.kind).toBe(0);
    expect(mapping.lastName).toBe(3);
    expect(mapping.siteType).toBe(15);
    expect(Object.keys(mapping)).toHaveLength(18);
  });

  it("n'utilise pas deux fois la même colonne et ignore les inconnues", () => {
    expect(guessMapping(["Nom", "Nom", "Divers"])).toEqual({ lastName: 0 });
  });
});

describe("mapImportRow", () => {
  it("convertit une ligne complète", () => {
    const { input, warnings } = mapImportRow(
      [
        "Entreprise",
        "Boulangerie du Lac",
        "Marc Dupont",
        "Rue du Lac 12",
        "CH-1000",
        "Lausanne",
        "Vaud",
        "INFO@BOULANGERIE.CH",
        "vitrine",
        "Allemand",
        "web, vip",
      ],
      {
        kind: 0,
        companyName: 1,
        contactName: 2,
        street: 3,
        postalCode: 4,
        city: 5,
        canton: 6,
        email: 7,
        siteType: 8,
        language: 9,
        tags: 10,
      },
      SITE_TYPES,
    );
    expect(warnings).toEqual([]);
    expect(input).toMatchObject({
      kind: "COMPANY",
      companyName: "Boulangerie du Lac",
      contactName: "Marc Dupont",
      street: "Rue du Lac",
      streetNumber: "12",
      postalCode: "1000",
      city: "Lausanne",
      canton: "VD",
      country: "CH",
      email: "info@boulangerie.ch",
      siteTypeId: SITE_TYPES[0]!.id,
      language: "DE",
      tags: ["web", "vip"],
    });
  });

  it("déduit le type : entreprise si une raison sociale est renseignée", () => {
    expect(mapImportRow(["Garage Martin"], { companyName: 0 }, []).input.kind).toBe("COMPANY");
    expect(mapImportRow(["Martin"], { lastName: 0 }, []).input.kind).toBe("INDIVIDUAL");
  });

  it("signale les valeurs non reconnues sans bloquer la ligne", () => {
    const { input, warnings } = mapImportRow(
      ["Martin", "Savoie", "Blog culinaire", "klingon"],
      { lastName: 0, canton: 1, siteType: 2, language: 3 },
      SITE_TYPES,
    );
    expect(input.canton).toBeNull();
    expect(input.siteTypeId).toBeNull();
    expect(input.language).toBe("FR");
    expect(warnings).toHaveLength(3);
  });

  it("garde rue et numéro séparés quand la colonne numéro est fournie", () => {
    const { input } = mapImportRow(["Route 66", "4"], { street: 0, streetNumber: 1 }, []);
    expect(input).toMatchObject({ street: "Route 66", streetNumber: "4" });
  });

  it("retire l'apostrophe de protection ajoutée par l'export CSV", () => {
    const { input } = mapImportRow(["'+41 21 555 55 55"], { phone: 0 }, []);
    expect(input.phone).toBe("+41 21 555 55 55");
  });

  it("ignore le canton d'un client étranger", () => {
    const { input } = mapImportRow(
      ["Martin", "Allemagne", "ZH"],
      { lastName: 0, country: 1, canton: 2 },
      [],
    );
    expect(input).toMatchObject({ country: "DE", canton: null });
  });
});
