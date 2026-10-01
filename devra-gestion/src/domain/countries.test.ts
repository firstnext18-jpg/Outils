import { describe, expect, it } from "vitest";
import { COUNTRY_OPTIONS, countryName, parseCountry } from "@/domain/countries";

describe("pays", () => {
  it("propose la Suisse en premier, avec son nom en français", () => {
    expect(COUNTRY_OPTIONS[0]).toEqual({ code: "CH", name: "Suisse", frequent: true });
    expect(countryName("DE")).toBe("Allemagne");
  });

  it("reconnaît un code ou un nom", () => {
    expect(parseCountry("ch")).toBe("CH");
    expect(parseCountry("Suisse")).toBe("CH");
    expect(parseCountry("Schweiz")).toBe("CH");
    expect(parseCountry("Allemagne")).toBe("DE");
    expect(parseCountry("Autriche")).toBe("AT");
    expect(parseCountry("Belgique")).toBe("BE");
    expect(parseCountry("Atlantide")).toBeNull();
  });
});
