import { describe, expect, it } from "vitest";
import { guessMapping, mapImportRow } from "@/domain/client-import";
import { CLIENT_EXPORT_HEADERS, clientExportRow } from "@/modules/clients/export";
import {
  buildCsv,
  buildXlsx,
  decodeText,
  parseCsv,
  parseXlsx,
  SpreadsheetError,
  toSheetTable,
} from "@/server/spreadsheet";

const encode = (text: string) => new TextEncoder().encode(text);

describe("decodeText", () => {
  it("lit l'UTF-8 et retire le BOM", () => {
    expect(decodeText(encode("﻿Genève"))).toBe("Genève");
  });

  it("se rabat sur Windows-1252 (CSV enregistrés par Excel)", () => {
    // « Genève » en Windows-1252 : è = 0xE8
    const bytes = new Uint8Array([0x47, 0x65, 0x6e, 0xe8, 0x76, 0x65]);
    expect(decodeText(bytes)).toBe("Genève");
  });
});

describe("parseCsv", () => {
  it("détecte le point-virgule et gère les guillemets", () => {
    const table = parseCsv(encode('Nom;Notes\r\nMartin;"Client ; fidèle"\r\n\r\nDupont;\r\n'));
    expect(table).toEqual({
      headers: ["Nom", "Notes"],
      rows: [
        ["Martin", "Client ; fidèle"],
        ["Dupont", ""],
      ],
    });
  });

  it("détecte la virgule", () => {
    expect(parseCsv(encode("Nom,Ville\nMartin,Sion")).rows).toEqual([["Martin", "Sion"]]);
  });

  it("refuse un fichier vide ou sans données", () => {
    expect(() => parseCsv(encode(""))).toThrow(SpreadsheetError);
    expect(() => parseCsv(encode("Nom;Ville\n"))).toThrow("ligne d'en-têtes");
  });
});

describe("toSheetTable", () => {
  it("nomme les colonnes sans en-tête, retire les colonnes vides à droite et aligne les lignes", () => {
    expect(toSheetTable([["Nom", "", "", ""], ["Martin", "Sion"], ["Dupont"]])).toEqual({
      headers: ["Nom", "Colonne 2"],
      rows: [
        ["Martin", "Sion"],
        ["Dupont", ""],
      ],
    });
  });
});

describe("buildCsv", () => {
  it("produit un CSV lisible par Excel (BOM, point-virgule, CRLF, guillemets)", () => {
    const csv = buildCsv(["Nom", "Notes"], [["Martin", 'Dit "le Grand"; fidèle']]);
    expect(csv).toBe('﻿Nom;Notes\r\nMartin;"Dit ""le Grand""; fidèle"\r\n');
  });

  it("neutralise les cellules qui ressembleraient à des formules", () => {
    const csv = buildCsv(["A"], [['=HYPERLINK("x")'], ["+41 21 555 55 55"], ["@SUM(1)"]]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("'+41 21 555 55 55");
    expect(csv).toContain("'@SUM(1)");
  });
});

describe("Excel", () => {
  it("écrit puis relit un classeur (accents, cellules vides)", async () => {
    const bytes = await buildXlsx(
      "Clients",
      ["Nom", "Ville"],
      [
        ["Zoé", "Genève"],
        ["Luca", ""],
      ],
    );
    const table = await parseXlsx(new Uint8Array(bytes));
    expect(table).toEqual({
      headers: ["Nom", "Ville"],
      rows: [
        ["Zoé", "Genève"],
        ["Luca", ""],
      ],
    });
  });

  it("refuse un fichier qui n'est pas un classeur", async () => {
    await expect(parseXlsx(encode("pas un fichier excel"))).rejects.toThrow(SpreadsheetError);
  });
});

describe("aller-retour export → import", () => {
  it("un fichier exporté se réimporte sans correspondance manuelle", async () => {
    const client = {
      kind: "COMPANY" as const,
      displayName: "Garage du Lac SA",
      firstName: "",
      lastName: "",
      companyName: "Garage du Lac SA",
      contactName: "Nadia Rochat",
      street: "Avenue des Alpes",
      streetNumber: "70",
      postalCode: "1820",
      city: "Montreux",
      canton: "VD" as const,
      country: "CH",
      email: "garage@dulac.example",
      phone: "+41 21 555 04 04",
      website: "garage-du-lac.example",
      siteType: { name: "Refonte" },
      language: "DE" as const,
      tags: ["auto", "prospect"],
      notes: "Rappeler en janvier",
      archivedAt: null,
      createdAt: new Date("2026-09-30T10:00:00Z"),
    };
    for (const table of [
      parseCsv(encode(buildCsv(CLIENT_EXPORT_HEADERS, [clientExportRow(client)]))),
      await parseXlsx(
        new Uint8Array(
          await buildXlsx("Clients", CLIENT_EXPORT_HEADERS, [clientExportRow(client)]),
        ),
      ),
    ]) {
      const mapping = guessMapping(table.headers);
      const { input, warnings } = mapImportRow(table.rows[0]!, mapping, [
        { id: "01900000-0000-7000-8000-000000000009", name: "Refonte" },
      ]);
      expect(warnings).toEqual([]);
      expect(input).toEqual({
        kind: "COMPANY",
        firstName: "",
        lastName: "",
        companyName: "Garage du Lac SA",
        contactName: "Nadia Rochat",
        street: "Avenue des Alpes",
        streetNumber: "70",
        postalCode: "1820",
        city: "Montreux",
        canton: "VD",
        country: "CH",
        email: "garage@dulac.example",
        phone: "+41 21 555 04 04",
        website: "garage-du-lac.example",
        siteTypeId: "01900000-0000-7000-8000-000000000009",
        language: "DE",
        tags: ["auto", "prospect"],
        notes: "Rappeler en janvier",
      });
    }
  });
});
