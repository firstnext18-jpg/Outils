import { describe, expect, it } from "vitest";
import {
  linkExpiry,
  onlineAcceptSchema,
  onlineQuoteState,
  onlineRefuseSchema,
} from "@/domain/online-quote";

const TOKEN = "a".repeat(43);

describe("acceptation des devis en ligne", () => {
  it("ouvre la décision tant que le devis est envoyé et valable", () => {
    expect(onlineQuoteState({ status: "SENT", validUntil: "2026-10-31" }, "2026-10-31")).toBe(
      "open",
    );
    expect(onlineQuoteState({ status: "SENT", validUntil: "2026-10-31" }, "2026-11-01")).toBe(
      "expired",
    );
    expect(onlineQuoteState({ status: "EXPIRED", validUntil: "2026-10-31" }, "2026-10-01")).toBe(
      "expired",
    );
    expect(onlineQuoteState({ status: "ACCEPTED", validUntil: "2026-10-31" }, "2026-12-01")).toBe(
      "accepted",
    );
    expect(onlineQuoteState({ status: "REFUSED", validUntil: "2026-10-31" }, "2026-10-01")).toBe(
      "refused",
    );
    expect(onlineQuoteState({ status: "DRAFT", validUntil: "2026-10-31" }, "2026-10-01")).toBe(
      "unavailable",
    );
  });

  it("garde le lien consultable 30 jours après la fin de validité (minuit à Zurich)", () => {
    expect(linkExpiry("2026-10-31").toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(linkExpiry("2026-06-15").toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });

  it("exige un nom et la case « J'accepte »", () => {
    expect(
      onlineAcceptSchema.safeParse({ token: TOKEN, name: "Jean Dupont", accept: true }).success,
    ).toBe(true);
    const unchecked = onlineAcceptSchema.safeParse({
      token: TOKEN,
      name: "Jean Dupont",
      accept: false,
    });
    expect(unchecked.success).toBe(false);
    expect(unchecked.error?.issues[0]?.message).toBe("Cochez la case pour accepter le devis");
    expect(onlineAcceptSchema.safeParse({ token: TOKEN, name: " J ", accept: true }).success).toBe(
      false,
    );
    expect(
      onlineAcceptSchema.safeParse({ token: "court", name: "Jean Dupont", accept: true }).success,
    ).toBe(false);
  });

  it("accepte un refus avec un commentaire facultatif", () => {
    expect(
      onlineRefuseSchema.safeParse({ token: TOKEN, name: "Jean Dupont", comment: "" }).success,
    ).toBe(true);
    expect(
      onlineRefuseSchema.safeParse({ token: TOKEN, name: "Jean Dupont", comment: "x".repeat(1001) })
        .success,
    ).toBe(false);
  });
});
