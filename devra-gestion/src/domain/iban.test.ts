import { describe, expect, it } from "vitest";
import {
  formatIban,
  hasValidIbanChecksum,
  isQrIban,
  isValidSwissIban,
  normalizeIban,
} from "@/domain/iban";

// Exemples publiés par SIX / les banques suisses.
const CLASSIC_IBAN = "CH9300762011623852957";
const QR_IBAN = "CH4431999123000889012";
const LI_IBAN = "LI21088100002324013AA";

describe("normalizeIban", () => {
  it("retire les espaces et met en majuscules", () => {
    expect(normalizeIban(" ch93 0076 2011 6238 5295 7 ")).toBe(CLASSIC_IBAN);
  });
});

describe("hasValidIbanChecksum", () => {
  it("accepte des IBAN valides de plusieurs pays", () => {
    expect(hasValidIbanChecksum(CLASSIC_IBAN)).toBe(true);
    expect(hasValidIbanChecksum("DE89370400440532013000")).toBe(true);
    expect(hasValidIbanChecksum("GB82WEST12345698765432")).toBe(true);
  });

  it("refuse une clé de contrôle fausse ou un format invalide", () => {
    expect(hasValidIbanChecksum("CH9300762011623852958")).toBe(false);
    expect(hasValidIbanChecksum("CH93-0076")).toBe(false);
    expect(hasValidIbanChecksum("")).toBe(false);
  });
});

describe("isValidSwissIban", () => {
  it("accepte les IBAN suisses et liechtensteinois", () => {
    expect(isValidSwissIban(CLASSIC_IBAN)).toBe(true);
    expect(isValidSwissIban("CH93 0076 2011 6238 5295 7")).toBe(true);
    expect(isValidSwissIban(LI_IBAN)).toBe(true);
  });

  it("refuse les IBAN étrangers (non utilisables sur une QR-facture)", () => {
    expect(isValidSwissIban("DE89370400440532013000")).toBe(false);
  });

  it("refuse une longueur incorrecte", () => {
    expect(isValidSwissIban("CH930076201162385295")).toBe(false);
  });
});

describe("isQrIban", () => {
  it("reconnaît un QR-IBAN (IID entre 30000 et 31999)", () => {
    expect(isQrIban(QR_IBAN)).toBe(true);
  });

  it("un IBAN classique n'est pas un QR-IBAN", () => {
    expect(isQrIban(CLASSIC_IBAN)).toBe(false);
  });

  it("un QR-IBAN avec une mauvaise clé n'est pas accepté", () => {
    expect(isQrIban("CH4431999123000889013")).toBe(false);
  });
});

describe("formatIban", () => {
  it("regroupe par 4 caractères", () => {
    expect(formatIban(CLASSIC_IBAN)).toBe("CH93 0076 2011 6238 5295 7");
    expect(formatIban("ch4431999123000889012")).toBe("CH44 3199 9123 0008 8901 2");
  });
});
