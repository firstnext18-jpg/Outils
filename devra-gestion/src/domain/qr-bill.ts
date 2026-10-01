/**
 * Données de la QR-facture suisse (section paiement et récépissé), au format
 * attendu par la librairie swissqrbill, qui les valide selon les règles SIX
 * et dessine la section paiement.
 *
 * Choix du compte : le QR-IBAN s'il est renseigné (référence QRR obligatoire),
 * sinon l'IBAN classique (référence SCOR). Les adresses sont structurées (rue,
 * numéro, NPA, localité séparés), comme l'exigent les banques depuis 2025.
 */
import type { Data } from "swissqrbill/types";
import { isQrIban, isValidSwissIban, normalizeIban } from "@/domain/iban";
import { qrrReference, scorReference } from "@/domain/qr-reference";

export type ReferenceType = "QRR" | "SCOR" | "NON";

/** Compte et référence de paiement d'une facture, fixés à l'émission. */
export type PaymentSetup = { account: string; referenceType: ReferenceType; reference: string };

export function paymentSetup(
  accounts: { iban: string; qrIban: string; qrReferencePrefix: string },
  invoice: { number: string; year: number; sequence: number },
): PaymentSetup | null {
  const qrIban = normalizeIban(accounts.qrIban);
  if (qrIban && isQrIban(qrIban)) {
    return {
      account: qrIban,
      referenceType: "QRR",
      reference: qrrReference(invoice.year, invoice.sequence, accounts.qrReferencePrefix),
    };
  }
  const iban = normalizeIban(accounts.iban);
  if (iban && isValidSwissIban(iban) && !isQrIban(iban)) {
    return { account: iban, referenceType: "SCOR", reference: scorReference(invoice.number) };
  }
  return null;
}

/** Adresse structurée d'un créancier ou d'un débiteur. */
export type QrAddress = {
  name: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

const cut = (value: string, max: number) => value.trim().slice(0, max);

function isComplete(address: QrAddress): boolean {
  return Boolean(
    address.name.trim() &&
    address.street.trim() &&
    address.postalCode.trim() &&
    address.city.trim() &&
    /^[A-Z]{2}$/.test(address.country),
  );
}

/** Ce qui manque à l'entreprise pour produire une QR-facture (vide si tout y est). */
export function missingQrRequirements(
  company: QrAddress & { iban: string; qrIban: string },
): string[] {
  const missing: string[] = [];
  const hasAccount =
    (company.qrIban && isQrIban(company.qrIban)) ||
    (company.iban && isValidSwissIban(company.iban) && !isQrIban(company.iban));
  if (!hasAccount) missing.push("IBAN ou QR-IBAN");
  if (!company.name.trim()) missing.push("nom de l'entreprise");
  if (!company.street.trim()) missing.push("rue");
  if (!company.postalCode.trim()) missing.push("NPA");
  if (!company.city.trim()) missing.push("localité");
  return missing;
}

function party(address: QrAddress) {
  return {
    name: cut(address.name, 70),
    address: cut(address.street, 70),
    ...(address.streetNumber.trim() ? { buildingNumber: cut(address.streetNumber, 16) } : {}),
    zip: cut(address.postalCode, 16),
    city: cut(address.city, 35),
    country: address.country,
  };
}

export function buildQrBillData(input: {
  setup: PaymentSetup;
  creditor: QrAddress;
  /** Débiteur (client) ; omis si son adresse est incomplète : la case reste à remplir à la main. */
  debtor: QrAddress | null;
  amountCents: number;
  /** « Informations supplémentaires » : ex. « Facture F-2026-014 ». */
  message: string;
}): Data {
  return {
    currency: "CHF",
    amount: input.amountCents / 100,
    creditor: { ...party(input.creditor), account: input.setup.account },
    ...(input.debtor && isComplete(input.debtor) ? { debtor: party(input.debtor) } : {}),
    ...(input.setup.referenceType !== "NON" ? { reference: input.setup.reference } : {}),
    message: cut(input.message, 140),
  };
}
