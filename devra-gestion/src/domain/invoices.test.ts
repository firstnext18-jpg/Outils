import { SwissQRBill } from "swissqrbill/pdf";
import { isQRReferenceValid, isSCORReferenceValid } from "swissqrbill/utils";
import { describe, expect, it } from "vitest";
import {
  balanceCents,
  canCancel,
  displayStatus,
  isOverdue,
  statusAfterPayments,
} from "@/domain/invoice-status";
import { deductedTotal, defaultDueDate, depositParts } from "@/domain/invoices";
import { buildQrBillData, missingQrRequirements, paymentSetup } from "@/domain/qr-bill";
import {
  formatReference,
  isValidQrrReference,
  isValidScorReference,
  mod10Recursive,
  qrrReference,
  scorReference,
} from "@/domain/qr-reference";
import { computeTotals, type CalcLine } from "@/domain/totals";

const CLASSIC_IBAN = "CH9300762011623852957";
const QR_IBAN = "CH4431999123000889012";

describe("références QRR (QR-IBAN)", () => {
  it("calcule la clé modulo 10 récursif (exemple SIX)", () => {
    expect(mod10Recursive("21000000000313947143000901")).toBe(7);
    expect(mod10Recursive("00000000000000000000000000")).toBe(0);
  });

  it("construit 27 chiffres à partir de l'année et du numéro", () => {
    const reference = qrrReference(2026, 14);
    expect(reference).toHaveLength(27);
    expect(reference.slice(0, 26)).toBe("00000000000000002026000014");
    expect(isValidQrrReference(reference)).toBe(true);
    expect(isQRReferenceValid(reference)).toBe(true);
  });

  it("place le préfixe imposé par la banque en tête", () => {
    const reference = qrrReference(2027, 1, "123456");
    expect(reference.startsWith("123456")).toBe(true);
    expect(reference.slice(16, 26)).toBe("2027000001");
    expect(isQRReferenceValid(reference)).toBe(true);
    expect(() => qrrReference(2026, 1, "12A")).toThrow();
  });

  it("donne des références différentes d'une année à l'autre", () => {
    expect(qrrReference(2026, 1)).not.toBe(qrrReference(2027, 1));
  });

  it("refuse une référence dont la clé est fausse", () => {
    const reference = qrrReference(2026, 14);
    const wrong = reference.slice(0, 26) + String((Number(reference[26]) + 1) % 10);
    expect(isValidQrrReference(wrong)).toBe(false);
  });
});

describe("références SCOR (IBAN classique, ISO 11649)", () => {
  it("retrouve l'exemple de la norme", () => {
    expect(scorReference("539007547034")).toBe("RF18539007547034");
  });

  it("utilise le numéro de facture sans séparateurs", () => {
    const reference = scorReference("F-2026-014");
    expect(reference).toMatch(/^RF\d{2}F2026014$/);
    expect(isValidScorReference(reference)).toBe(true);
    expect(isSCORReferenceValid(reference)).toBe(true);
    // Un caractère modifié est détecté.
    expect(isValidScorReference(reference.replace("F2026014", "F2026015"))).toBe(false);
  });

  it("met en forme les références par groupes", () => {
    expect(formatReference("210000000003139471430009017")).toBe("21 00000 00003 13947 14300 09017");
    expect(formatReference("RF18539007547034")).toBe("RF18 5390 0754 7034");
  });
});

describe("compte et référence de paiement", () => {
  const invoice = { number: "F-2026-003", year: 2026, sequence: 3 };

  it("préfère le QR-IBAN (référence QRR)", () => {
    const setup = paymentSetup(
      { iban: CLASSIC_IBAN, qrIban: QR_IBAN, qrReferencePrefix: "" },
      invoice,
    );
    expect(setup).toEqual({
      account: QR_IBAN,
      referenceType: "QRR",
      reference: qrrReference(2026, 3),
    });
  });

  it("utilise l'IBAN classique avec une référence SCOR", () => {
    const setup = paymentSetup({ iban: CLASSIC_IBAN, qrIban: "", qrReferencePrefix: "" }, invoice);
    expect(setup?.referenceType).toBe("SCOR");
    expect(setup?.reference).toBe(scorReference("F-2026-003"));
  });

  it("sans compte valable, pas de QR-facture", () => {
    expect(paymentSetup({ iban: "", qrIban: "", qrReferencePrefix: "" }, invoice)).toBeNull();
    // Un QR-IBAN saisi comme IBAN classique ne convient pas (il exige une référence QRR).
    expect(paymentSetup({ iban: QR_IBAN, qrIban: "", qrReferencePrefix: "" }, invoice)).toBeNull();
  });
});

describe("données de la QR-facture", () => {
  const creditor = {
    name: "Devra",
    street: "Rue du Lac",
    streetNumber: "12",
    postalCode: "1003",
    city: "Lausanne",
    country: "CH",
  };
  const debtor = {
    name: "Boulangerie des Alpes Sàrl",
    street: "Grand-Rue",
    streetNumber: "5",
    postalCode: "1820",
    city: "Montreux",
    country: "CH",
  };

  it("produit des données valides avec un QR-IBAN (vérifiées par swissqrbill)", () => {
    const setup = paymentSetup(
      { iban: "", qrIban: QR_IBAN, qrReferencePrefix: "" },
      { number: "F-2026-001", year: 2026, sequence: 1 },
    )!;
    const data = buildQrBillData({
      setup,
      creditor,
      debtor,
      amountCents: 146_475,
      message: "Facture F-2026-001",
    });
    expect(data).toMatchObject({
      currency: "CHF",
      amount: 1464.75,
      reference: setup.reference,
      message: "Facture F-2026-001",
      creditor: { account: QR_IBAN, name: "Devra", address: "Rue du Lac", buildingNumber: "12" },
      debtor: { name: "Boulangerie des Alpes Sàrl", zip: "1820", city: "Montreux" },
    });
    expect(() => new SwissQRBill(data, { language: "FR" })).not.toThrow();
  });

  it("produit des données valides avec un IBAN classique et une référence SCOR", () => {
    const setup = paymentSetup(
      { iban: CLASSIC_IBAN, qrIban: "", qrReferencePrefix: "" },
      { number: "F-2026-002", year: 2026, sequence: 2 },
    )!;
    const data = buildQrBillData({
      setup,
      creditor,
      debtor,
      amountCents: 5,
      message: "Rechnung F-2026-002",
    });
    expect(data.reference).toMatch(/^RF/);
    expect(() => new SwissQRBill(data, { language: "DE" })).not.toThrow();
  });

  it("omet le débiteur dont l'adresse est incomplète et raccourcit les textes trop longs", () => {
    const setup = paymentSetup(
      { iban: CLASSIC_IBAN, qrIban: "", qrReferencePrefix: "" },
      { number: "F-2026-002", year: 2026, sequence: 2 },
    )!;
    const data = buildQrBillData({
      setup,
      creditor: { ...creditor, name: "X".repeat(90) },
      debtor: { ...debtor, street: "" },
      amountCents: 10_000,
      message: "M".repeat(200),
    });
    expect(data.debtor).toBeUndefined();
    expect(data.creditor.name).toHaveLength(70);
    expect(data.message).toHaveLength(140);
    expect(() => new SwissQRBill(data)).not.toThrow();
  });

  it("indique ce qui manque à l'entreprise", () => {
    expect(missingQrRequirements({ ...creditor, iban: CLASSIC_IBAN, qrIban: "" })).toEqual([]);
    expect(
      missingQrRequirements({ ...creditor, name: "", city: "", iban: "", qrIban: "" }),
    ).toEqual(["IBAN ou QR-IBAN", "nom de l'entreprise", "localité"]);
  });
});

describe("statuts et solde", () => {
  it("passe en retard le lendemain de l'échéance seulement", () => {
    expect(isOverdue("SENT", "2026-10-15", "2026-10-15")).toBe(false);
    expect(isOverdue("SENT", "2026-10-15", "2026-10-16")).toBe(true);
    expect(isOverdue("PARTIALLY_PAID", "2026-10-15", "2026-10-16")).toBe(true);
    expect(isOverdue("PAID", "2026-10-15", "2026-12-01")).toBe(false);
    expect(isOverdue("DRAFT", "2026-10-15", "2026-12-01")).toBe(false);
    expect(displayStatus("SENT", "2026-10-15", "2026-10-16")).toBe("OVERDUE");
    expect(displayStatus("CANCELLED", "2026-10-15", "2026-10-16")).toBe("CANCELLED");
  });

  it("déduit le statut des paiements", () => {
    expect(statusAfterPayments(100_000, 0)).toBe("SENT");
    expect(statusAfterPayments(100_000, 40_000)).toBe("PARTIALLY_PAID");
    expect(statusAfterPayments(100_000, 100_000)).toBe("PAID");
    // Facture finale entièrement couverte par l'acompte : rien à payer.
    expect(statusAfterPayments(0, 0)).toBe("PAID");
    expect(balanceCents(100_000, 40_000)).toBe(60_000);
    expect(balanceCents(100_000, 120_000)).toBe(0);
  });

  it("n'annule qu'une facture envoyée sans paiement", () => {
    expect(canCancel("SENT", 0)).toBe(true);
    expect(canCancel("SENT", 1)).toBe(false);
    expect(canCancel("PARTIALLY_PAID", 5000)).toBe(false);
    expect(canCancel("DRAFT", 0)).toBe(false);
  });

  it("calcule l'échéance par défaut, y compris au changement d'année", () => {
    expect(defaultDueDate("2026-10-01", 15)).toBe("2026-10-16");
    expect(defaultDueDate("2026-12-20", 15)).toBe("2027-01-04");
  });
});

const line = (overrides: Partial<CalcLine>): CalcLine => ({
  lineType: "FLAT",
  periodicity: null,
  quantityMilli: 1000,
  unitPriceCents: 0,
  discount: null,
  vatRateBps: null,
  ...overrides,
});

describe("totaux d'une facture", () => {
  it("compte les lignes d'abonnement dans le montant à payer", () => {
    const lines = [
      line({ unitPriceCents: 149_000 }),
      line({ lineType: "SUBSCRIPTION", periodicity: "YEARLY", unitPriceCents: 29_000 }),
    ];
    const quote = computeTotals({ lines, globalDiscount: null, deposit: null, vatEnabled: false });
    expect(quote.oneTime.totalCents).toBe(149_000);
    const invoice = computeTotals({
      lines,
      globalDiscount: null,
      deposit: null,
      vatEnabled: false,
      separateRecurring: false,
    });
    expect(invoice.oneTime.totalCents).toBe(178_000);
    expect(invoice.recurring).toEqual([]);
  });
});

describe("acompte et facture finale", () => {
  it("sans TVA : une seule part, égale à l'acompte", () => {
    const totals = computeTotals({
      lines: [line({ unitPriceCents: 146_475 })],
      globalDiscount: null,
      deposit: { type: "PERCENT", value: 3000 },
      vatEnabled: false,
    });
    expect(totals.depositCents).toBe(43_945);
    expect(depositParts(totals.oneTime, totals.depositCents, false)).toEqual([
      { vatRateBps: null, netCents: 43_945 },
    ]);
  });

  it("avec TVA : la facture d'acompte retombe sur le montant prévu", () => {
    const quoteLines = [
      line({ unitPriceCents: 100_000, vatRateBps: 810 }),
      line({ unitPriceCents: 20_000, vatRateBps: 260 }),
      line({ unitPriceCents: 5_000, vatRateBps: 0 }),
    ];
    const quote = computeTotals({
      lines: quoteLines,
      globalDiscount: { type: "PERCENT", value: 1000 },
      deposit: { type: "PERCENT", value: 3000 },
      vatEnabled: true,
    });
    const parts = depositParts(quote.oneTime, quote.depositCents, true);
    expect(parts.map((p) => p.vatRateBps)).toEqual([810, 260, 0]);

    // La facture d'acompte calculée avec ces parts retrouve l'acompte du devis.
    const depositInvoice = computeTotals({
      lines: parts.map((p) => line({ unitPriceCents: p.netCents, vatRateBps: p.vatRateBps })),
      globalDiscount: null,
      deposit: null,
      vatEnabled: true,
      separateRecurring: false,
    });
    expect(depositInvoice.oneTime.totalCents).toBe(quote.depositCents);
  });

  it("déduit les acomptes facturés du total de la facture finale", () => {
    const deductions = [
      { invoiceId: "a", number: "F-2026-004", amountCents: 43_945 },
      { invoiceId: "b", number: "F-2026-006", amountCents: 10_000 },
    ];
    expect(deductedTotal(deductions)).toBe(53_945);
    expect(146_475 - deductedTotal(deductions)).toBe(92_530);
  });
});
