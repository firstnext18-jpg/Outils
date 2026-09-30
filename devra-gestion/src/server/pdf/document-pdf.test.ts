import { describe, expect, it } from "vitest";
import { computeTotals } from "@/domain/totals";
import { renderDocumentPdf, type PdfDocumentData, type PdfLine } from "@/server/pdf/document-pdf";

const company = {
  name: "Entreprise Test",
  street: "Rue du Test",
  streetNumber: "1",
  postalCode: "1000",
  city: "Lausanne",
  country: "CH",
  email: "test@example.ch",
  phone: "",
  website: "",
  vatNumber: "",
  logoFile: null,
  footerFr: "Merci",
  footerDe: "Danke",
};

function data(lines: PdfLine[], overrides: Partial<PdfDocumentData> = {}): PdfDocumentData {
  const totals = computeTotals({
    lines: lines.map((l) => ({ ...l, vatRateBps: null })),
    globalDiscount: null,
    deposit: { type: "PERCENT", value: 3000 },
    vatEnabled: false,
  });
  return {
    language: "FR",
    title: "Devis D-2026-001",
    draft: false,
    company,
    logo: null,
    recipient: {
      name: "Client Test",
      contact: "",
      street: "Rue 2",
      postalCity: "1200 Genève",
      country: null,
    },
    meta: [["Date", "30.09.2026"]],
    intro: "Introduction",
    lines,
    totals,
    globalDiscount: null,
    deposit: { type: "PERCENT", value: 3000 },
    vatEnabled: false,
    conditions: "Conditions",
    info: { title: "Devis D-2026-001", subject: "Test" },
    ...overrides,
  };
}

const line = (i: number): PdfLine => ({
  lineType: i % 5 === 0 ? "SUBSCRIPTION" : "FLAT",
  periodicity: i % 5 === 0 ? "MONTHLY" : null,
  label: `Prestation ${i} avec un nom assez long pour passer sur deux lignes dans la colonne`,
  description: "Description détaillée de la prestation, sur plusieurs lignes si nécessaire.",
  quantityMilli: 1000,
  unit: i % 5 === 0 ? "MONTH" : "FLAT",
  unitPriceCents: 10_000 + i,
  discount: null,
  netCents: 10_000 + i,
});

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

describe("renderDocumentPdf", () => {
  it("produit un PDF A4 d'une page", async () => {
    const pdf = await renderDocumentPdf(data([line(1), line(5)]));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
    expect(pdf.toString("latin1")).toContain("/MediaBox [0 0 595.28 841.89]");
  });

  it("passe à la page suivante quand les lignes sont nombreuses", async () => {
    const lines = Array.from({ length: 40 }, (_, i) => line(i + 1));
    const pdf = await renderDocumentPdf(data(lines));
    expect(pageCount(pdf)).toBeGreaterThan(1);
  });

  it("fonctionne en allemand, en brouillon et avec un logo illisible", async () => {
    const pdf = await renderDocumentPdf(
      data([line(1)], { language: "DE", draft: true, logo: Buffer.from("pas une image") }),
    );
    expect(pageCount(pdf)).toBe(1);
  });
});
