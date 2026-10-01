import { describe, expect, it } from "vitest";
import { buildQrBillData, paymentSetup } from "@/domain/qr-bill";
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
    watermark: null,
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
      data([line(1)], { language: "DE", watermark: "ENTWURF", logo: Buffer.from("pas une image") }),
    );
    expect(pageCount(pdf)).toBe(1);
  });
});

/**
 * Texte d'un PDF non compressé : PDFKit écrit les chaînes en hexadécimal
 * (codage WinAnsi) dans des tableaux TJ, découpées par le crénage.
 */
function pdfText(pdf: Buffer): string {
  const arrays = pdf.toString("latin1").match(/\[([^\]]*)\] TJ/g) ?? [];
  return arrays
    .map((array) =>
      (array.match(/<([0-9a-f]+)>/g) ?? [])
        .map((hex) => Buffer.from(hex.slice(1, -1), "hex").toString("latin1"))
        .join(""),
    )
    .join("\n");
}

const qrBill = buildQrBillData({
  setup: paymentSetup(
    { iban: "", qrIban: "CH4431999123000889012", qrReferencePrefix: "" },
    { number: "F-2026-001", year: 2026, sequence: 1 },
  )!,
  creditor: company,
  debtor: {
    name: "Client Test",
    street: "Rue",
    streetNumber: "2",
    postalCode: "1200",
    city: "Genève",
    country: "CH",
  },
  amountCents: 20_010,
  message: "Facture F-2026-001",
});

const shortLine: PdfLine = { ...line(1), label: "Site vitrine", description: "" };

describe("facture avec QR-facture", () => {
  const invoice = (lines: PdfLine[], language: "FR" | "DE" = "FR") =>
    data(lines, {
      language,
      title: "Facture F-2026-001",
      deposit: null,
      separateRecurring: false,
      qrBill,
      uncompressed: true,
    });

  it("place la section paiement en bas de l'unique page", async () => {
    const pdf = await renderDocumentPdf(invoice([shortLine]));
    expect(pageCount(pdf)).toBe(1);
    const text = pdfText(pdf);
    expect(text).toContain("Récépissé");
    expect(text).toContain("Section paiement");
    expect(text).toContain("Facture F-2026-001");
    expect(text).toContain("CH44 3199 9123 0008 8901 2");
  });

  it("passe la section paiement sur une nouvelle page s'il manque de la place", async () => {
    // Le plus grand nombre de lignes qui tient sur une page sans QR-facture…
    let lines = [line(1)];
    while (
      pageCount(await renderDocumentPdf({ ...invoice([...lines, line(1)]), qrBill: null })) === 1
    ) {
      lines = [...lines, line(1)];
    }
    expect(pageCount(await renderDocumentPdf({ ...invoice(lines), qrBill: null }))).toBe(1);
    // …laisse trop peu de place en bas de page : la QR-facture passe sur la page suivante.
    expect(pageCount(await renderDocumentPdf(invoice(lines)))).toBe(2);
  });

  it("traduit la section paiement en allemand", async () => {
    const text = pdfText(await renderDocumentPdf(invoice([shortLine], "DE")));
    expect(text).toContain("Empfangsschein");
    expect(text).toContain("Zahlteil");
  });

  it("affiche les acomptes déduits et le montant à payer", async () => {
    const text = pdfText(
      await renderDocumentPdf({
        ...invoice([shortLine]),
        deductions: [{ number: "F-2026-000", amountCents: 3_000 }],
      }),
    );
    expect(text).toContain("Acompte facturé (F-2026-000)");
    expect(text).toContain("Montant à payer");
  });
});
