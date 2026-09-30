import { describe, expect, it } from "vitest";
import { emptyLine, lineFromCatalog, quoteToInput } from "@/modules/quotes/form";
import { quoteInputSchema, type QuoteInput } from "@/modules/quotes/schemas";

const CLIENT = "01900000-0000-7000-8000-000000000001";

const input = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
  clientId: CLIENT,
  language: "FR",
  issueDate: "2026-09-30",
  validUntil: "2026-10-30",
  subject: "Site vitrine",
  siteTypeId: null,
  introText: "",
  conditionsText: "",
  globalDiscountType: "PERCENT",
  globalDiscountValue: "",
  depositType: "PERCENT",
  depositValue: "30",
  lines: [{ ...emptyLine(null), label: "Site vitrine", unitPrice: "1'490.00" }],
  ...overrides,
});

describe("quoteInputSchema", () => {
  it("convertit les saisies en valeurs calculables", () => {
    const data = quoteInputSchema.parse(
      input({
        globalDiscountType: "AMOUNT",
        globalDiscountValue: "100",
        lines: [
          {
            ...emptyLine(null),
            label: "Modifications",
            lineType: "HOURLY",
            unit: "HOUR",
            quantity: "2,5",
            unitPrice: "90",
            discountType: "PERCENT",
            discountValue: "10",
          },
        ],
      }),
    );
    expect(data.lines[0]).toMatchObject({
      quantityMilli: 2500,
      unitPriceCents: 9000,
      discount: { type: "PERCENT", value: 1000 },
    });
    expect(data.globalDiscount).toEqual({ type: "AMOUNT", value: 10_000 });
    expect(data.deposit).toEqual({ type: "PERCENT", value: 3000 });
  });

  it("une valeur vide ou nulle signifie « pas de remise »", () => {
    const data = quoteInputSchema.parse(input({ depositValue: "", globalDiscountValue: "0" }));
    expect(data.deposit).toBeNull();
    expect(data.globalDiscount).toBeNull();
  });

  it("signale les erreurs sur les bons champs", () => {
    const result = quoteInputSchema.safeParse(
      input({
        validUntil: "2026-09-01",
        depositValue: "150",
        lines: [{ ...emptyLine(null), label: "", quantity: "0", unitPrice: "abc" }],
      }),
    );
    const paths = result.error?.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining([
        "validUntil",
        "depositValue",
        "lines.0.label",
        "lines.0.quantity",
        "lines.0.unitPrice",
      ]),
    );
  });

  it("exige au moins une ligne et un client", () => {
    const result = quoteInputSchema.safeParse(input({ clientId: "", lines: [] }));
    expect(result.error?.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining(["Choisissez un client", "Ajoutez au moins une ligne"]),
    );
  });
});

describe("conversions du formulaire", () => {
  const item = {
    id: "01900000-0000-7000-8000-000000000002",
    name: "Hébergement + maintenance",
    nameDe: "Hosting + Wartung",
    description: "Hébergement en Suisse",
    descriptionDe: "",
    lineType: "SUBSCRIPTION" as const,
    periodicity: "MONTHLY" as const,
    unit: "MONTH" as const,
    unitPriceCents: 2_900,
  };

  it("une prestation du catalogue prend le texte allemand s'il existe", () => {
    expect(lineFromCatalog(item, "DE", 810)).toMatchObject({
      label: "Hosting + Wartung",
      description: "Hébergement en Suisse", // pas de description allemande : texte français
      unitPrice: "29.00",
      unit: "MONTH",
      vatRateBps: 810,
    });
    expect(lineFromCatalog(item, "FR", null).label).toBe("Hébergement + maintenance");
  });

  it("aller-retour base → formulaire → base sans perte", () => {
    const stored = {
      clientId: CLIENT,
      language: "FR" as const,
      issueDate: new Date("2026-09-30T00:00:00Z"),
      validUntil: new Date("2026-10-30T00:00:00Z"),
      subject: "Refonte",
      siteTypeId: null,
      introText: "Bonjour",
      conditionsText: "Merci",
      globalDiscountType: "PERCENT" as const,
      globalDiscountValue: 750,
      depositType: "AMOUNT" as const,
      depositValue: 50_000,
      lines: [
        {
          catalogItemId: null,
          lineType: "HOURLY" as const,
          periodicity: null,
          label: "Modifications",
          description: "",
          quantityMilli: 1250,
          unit: "HOUR" as const,
          unitPriceCents: 9_000,
          discountType: "AMOUNT" as const,
          discountValue: 1_050,
          vatRateBps: null,
        },
      ],
    };
    const data = quoteInputSchema.parse(quoteToInput(stored));
    expect(data).toMatchObject({
      issueDate: "2026-09-30",
      globalDiscount: { type: "PERCENT", value: 750 },
      deposit: { type: "AMOUNT", value: 50_000 },
      lines: [
        { quantityMilli: 1250, unitPriceCents: 9_000, discount: { type: "AMOUNT", value: 1_050 } },
      ],
    });
  });
});
