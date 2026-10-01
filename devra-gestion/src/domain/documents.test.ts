import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatIsoDate,
  isValidIsoDate,
  todayIso,
  yearOf,
} from "@/domain/dates";
import { centsToInput, roundTo5Cents } from "@/domain/money";
import { documentFileName, fileNamePart } from "@/domain/file-names";
import { formatDocumentNumber, validateNumberFormat } from "@/domain/numbering";
import { formatPercent, parsePercent } from "@/domain/percent";
import { formatQuantity, parseQuantity } from "@/domain/quantity";
import { canTransition, isQuoteEditable, isQuoteExpired } from "@/domain/quote-status";

describe("numérotation", () => {
  it("D-AAAA-NNN", () => {
    expect(formatDocumentNumber("D-{AAAA}-{NNN}", 2026, 1)).toBe("D-2026-001");
    expect(formatDocumentNumber("D-{AAAA}-{NNN}", 2026, 42)).toBe("D-2026-042");
    // Au-delà de 999, le numéro s'allonge au lieu d'être tronqué.
    expect(formatDocumentNumber("D-{AAAA}-{NNN}", 2026, 1234)).toBe("D-2026-1234");
    expect(formatDocumentNumber("F{AA}/{NNNN}", 2027, 7)).toBe("F27/0007");
  });

  it("changement d'année : le numéro dépend de l'année de la date du document", () => {
    expect(formatDocumentNumber("D-{AAAA}-{NNN}", yearOf("2026-12-31"), 57)).toBe("D-2026-057");
    expect(formatDocumentNumber("D-{AAAA}-{NNN}", yearOf("2027-01-01"), 1)).toBe("D-2027-001");
  });

  it("valide les formats", () => {
    expect(validateNumberFormat("D-{AAAA}-{NNN}")).toBeNull();
    expect(validateNumberFormat("OF{AA}{NNNN}")).toBeNull();
    expect(validateNumberFormat("D-{NNN}")).toMatch(/année/);
    expect(validateNumberFormat("D-{AAAA}")).toMatch(/compteur/);
    expect(validateNumberFormat("D-{AAAA}-{NNN}-{NN}")).toMatch(/un et un seul/);
    expect(validateNumberFormat("D-{MM}-{NNN}")).toMatch(/Jeton inconnu/);
    expect(validateNumberFormat("Devis {AAAA} {NNN}")).toMatch(/caractères/);
    expect(validateNumberFormat("")).not.toBeNull();
  });
});

describe("dates des documents", () => {
  it("aujourd'hui est calculé à Zurich", () => {
    // 31.12.2025 à 23:30 UTC = 01.01.2026 à 00:30 à Zurich
    expect(todayIso(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
    expect(todayIso(new Date("2026-06-30T21:59:00Z"))).toBe("2026-06-30");
  });

  it("ajoute des jours (fins de mois, années bissextiles)", () => {
    expect(addDays("2026-09-30", 30)).toBe("2026-10-30");
    expect(addDays("2026-12-15", 30)).toBe("2027-01-14");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-09-30", "2026-10-30")).toBe(30);
  });

  it("valide et affiche", () => {
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("30.09.2026")).toBe(false);
    expect(formatIsoDate("2026-09-30")).toBe("30.09.2026");
  });
});

describe("quantités et pourcentages", () => {
  it.each([
    ["1", 1000],
    ["1,5", 1500],
    ["0.25", 250],
    ["2.125", 2125],
    ["10", 10_000],
  ])("quantité « %s » → %i millièmes", (input, milli) => {
    expect(parseQuantity(input)).toBe(milli);
  });

  it("refuse les quantités invalides", () => {
    expect(parseQuantity("1.2345")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
    expect(parseQuantity("deux")).toBeNull();
  });

  it("affiche les quantités sans zéros inutiles", () => {
    expect([
      formatQuantity(1000),
      formatQuantity(1500),
      formatQuantity(250),
      formatQuantity(2125),
    ]).toEqual(["1", "1.5", "0.25", "2.125"]);
  });

  it("pourcentages en points de base", () => {
    expect(parsePercent("10")).toBe(1000);
    expect(parsePercent("8,1")).toBe(810);
    expect(parsePercent("12.5 %")).toBe(1250);
    expect(parsePercent("101")).toBeNull();
    expect(parsePercent("1.234")).toBeNull();
    expect(formatPercent(810)).toBe("8.1\u00A0%");
    expect(formatPercent(3000)).toBe("30\u00A0%");
  });
});

describe("montants", () => {
  it("arrondi aux 5 centimes, aussi pour les montants négatifs (notes de crédit)", () => {
    expect([
      roundTo5Cents(102),
      roundTo5Cents(103),
      roundTo5Cents(-102),
      roundTo5Cents(-103),
    ]).toEqual([100, 105, -100, -105]);
  });

  it("centimes → valeur de champ", () => {
    expect(centsToInput(149_050)).toBe("1490.50");
    expect(centsToInput(5)).toBe("0.05");
  });
});

describe("statuts d'un devis", () => {
  it("seul un brouillon est modifiable", () => {
    expect(isQuoteEditable("DRAFT")).toBe(true);
    expect(isQuoteEditable("SENT")).toBe(false);
  });

  it("changements permis", () => {
    expect(canTransition("DRAFT", "SENT")).toBe(true);
    expect(canTransition("DRAFT", "ACCEPTED")).toBe(false);
    expect(canTransition("SENT", "ACCEPTED")).toBe(true);
    expect(canTransition("SENT", "DRAFT")).toBe(true);
    expect(canTransition("REFUSED", "ACCEPTED")).toBe(false);
    expect(canTransition("EXPIRED", "ACCEPTED")).toBe(true);
  });

  it("expire le lendemain de la date de validité", () => {
    expect(isQuoteExpired("SENT", "2026-10-30", "2026-10-30")).toBe(false);
    expect(isQuoteExpired("SENT", "2026-10-30", "2026-10-31")).toBe(true);
    expect(isQuoteExpired("DRAFT", "2026-10-30", "2026-12-31")).toBe(false);
    expect(isQuoteExpired("ACCEPTED", "2026-10-30", "2026-12-31")).toBe(false);
  });
});

describe("noms des fichiers PDF", () => {
  it("assemble entreprise, type, numéro et client sans caractères spéciaux", () => {
    expect(fileNamePart("Boulangerie des Alpes Sàrl")).toBe("BoulangerieDesAlpesSarl");
    expect(documentFileName("Devra", "Devis", "D-2026-001", "Zoé Keller")).toBe(
      "Devra_Devis_D-2026-001_ZoeKeller.pdf",
    );
    expect(documentFileName("Devra", "Offerte", "D/2026/001", "Café & Co")).toBe(
      "Devra_Offerte_D-2026-001_CafeCo.pdf",
    );
  });

  it("omet l'entreprise tant que son nom n'est pas renseigné", () => {
    expect(documentFileName(" ", "Devis", "D-2026-001", "Menuiserie Test SA")).toBe(
      "Devis_D-2026-001_MenuiserieTestSA.pdf",
    );
    expect(documentFileName("", "Devis", "D-2026-001", "***")).toBe(
      "Devis_D-2026-001_Document.pdf",
    );
  });
});
