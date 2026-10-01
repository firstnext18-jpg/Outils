import { describe, expect, it } from "vitest";
import { clientInputSchema, clientListParamsSchema, EMPTY_CLIENT } from "@/modules/clients/schemas";

describe("clientInputSchema", () => {
  it("exige le nom d'un particulier et la raison sociale d'une entreprise", () => {
    const individual = clientInputSchema.safeParse({ ...EMPTY_CLIENT, kind: "INDIVIDUAL" });
    expect(individual.success).toBe(false);
    expect(individual.error?.issues[0]?.path).toEqual(["lastName"]);

    const company = clientInputSchema.safeParse({
      ...EMPTY_CLIENT,
      kind: "COMPANY",
      lastName: "Martin",
    });
    expect(company.error?.issues[0]?.path).toEqual(["companyName"]);
  });

  it("vide les champs sans objet pour le type choisi", () => {
    const result = clientInputSchema.parse({
      ...EMPTY_CLIENT,
      kind: "COMPANY",
      companyName: "Garage Martin",
      firstName: "Paul",
      lastName: "Martin",
    });
    expect(result).toMatchObject({ companyName: "Garage Martin", firstName: "", lastName: "" });
  });

  it("vérifie le NPA suisse et ignore le canton hors de Suisse", () => {
    expect(
      clientInputSchema.safeParse({ ...EMPTY_CLIENT, lastName: "A", postalCode: "100" }).success,
    ).toBe(false);
    expect(
      clientInputSchema.safeParse({
        ...EMPTY_CLIENT,
        lastName: "A",
        country: "FR",
        postalCode: "74000",
      }).success,
    ).toBe(true);
    const foreign = clientInputSchema.parse({
      ...EMPTY_CLIENT,
      lastName: "A",
      country: "de",
      canton: "ZH",
    });
    expect(foreign).toMatchObject({ country: "DE", canton: null });
  });

  it("met l'email en minuscules et nettoie les tags", () => {
    const result = clientInputSchema.parse({
      ...EMPTY_CLIENT,
      lastName: "A",
      email: " Lea@Example.CH ",
      tags: ["web", " Web ", "vip"],
    });
    expect(result.email).toBe("lea@example.ch");
    expect(result.tags).toEqual(["web", "vip"]);
  });
});

describe("clientListParamsSchema", () => {
  it("ignore les paramètres invalides au lieu de planter", () => {
    expect(
      clientListParamsSchema.parse({ canton: "XX", page: "abc", tri: "nom", type: "entreprise" }),
    ).toEqual({
      q: undefined,
      type: "entreprise",
      canton: undefined,
      site: undefined,
      tag: undefined,
      statut: undefined,
      tri: "nom",
      page: undefined,
    });
  });
});
