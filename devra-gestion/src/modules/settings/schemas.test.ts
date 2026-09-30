import { describe, expect, it } from "vitest";
import { companySettingsSchema, type CompanySettingsInput } from "@/modules/settings/schemas";

const base: CompanySettingsInput = {
  companyName: "Devra",
  companyStreet: "Rue du Lac",
  companyStreetNumber: "1",
  companyPostalCode: "1000",
  companyCity: "Lausanne",
  companyCountry: "ch",
  companyEmail: "",
  companyPhone: "",
  companyWebsite: "",
  iban: "",
  qrIban: "",
};

describe("companySettingsSchema", () => {
  it("normalise l'IBAN et le code pays", () => {
    const result = companySettingsSchema.parse({ ...base, iban: "ch93 0076 2011 6238 5295 7" });
    expect(result.iban).toBe("CH9300762011623852957");
    expect(result.companyCountry).toBe("CH");
  });

  it("refuse un QR-IBAN dans le champ IBAN, et l'inverse", () => {
    expect(
      companySettingsSchema.safeParse({ ...base, iban: "CH4431999123000889012" }).success,
    ).toBe(false);
    expect(
      companySettingsSchema.safeParse({ ...base, qrIban: "CH9300762011623852957" }).success,
    ).toBe(false);
    expect(
      companySettingsSchema.safeParse({ ...base, qrIban: "CH4431999123000889012" }).success,
    ).toBe(true);
  });

  it("exige le nom de l'entreprise", () => {
    expect(companySettingsSchema.safeParse({ ...base, companyName: "  " }).success).toBe(false);
  });

  it("respecte les longueurs maximales de la QR-facture", () => {
    expect(companySettingsSchema.safeParse({ ...base, companyName: "x".repeat(71) }).success).toBe(
      false,
    );
    expect(companySettingsSchema.safeParse({ ...base, companyCity: "x".repeat(36) }).success).toBe(
      false,
    );
  });
});
