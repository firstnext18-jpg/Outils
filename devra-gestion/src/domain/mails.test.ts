import { describe, expect, it } from "vitest";
import {
  bareMessageId,
  mailExcerpt,
  normalizeAddress,
  replyHeaders,
  replySubject,
  splitQuoted,
} from "@/domain/mails";

describe("section Mail", () => {
  it("compare les adresses sans tenir compte de la casse", () => {
    expect(normalizeAddress("  Lucie@Atelier.CH ")).toBe("lucie@atelier.ch");
    expect(normalizeAddress(null)).toBe("");
  });

  it("nettoie les Message-ID", () => {
    expect(bareMessageId("<abc.123@mail.exemple.ch>")).toBe("abc.123@mail.exemple.ch");
    expect(bareMessageId(undefined)).toBe("");
  });

  it("préfixe l'objet d'une réponse une seule fois", () => {
    expect(replySubject("Votre site")).toBe("Re: Votre site");
    expect(replySubject("RE: Votre site")).toBe("RE: Votre site");
    expect(replySubject("AW: Ihre Website")).toBe("AW: Ihre Website");
    expect(replySubject("  ")).toBe("Re: (sans objet)");
  });

  it("garde le fil de la conversation", () => {
    expect(replyHeaders({ messageId: "c@x", references: ["a@x", "b@x"] })).toEqual({
      inReplyTo: "c@x",
      references: ["a@x", "b@x", "c@x"],
    });
  });

  it("sépare la réponse du message cité", () => {
    const reply = [
      "Bonjour,",
      "",
      "Parfait, merci !",
      "",
      "Le mar. 24 nov. 2026 à 14:02, Devra <contact@exemple.ch> a écrit :",
      "> Bonjour,",
      "> voici la maquette.",
    ].join("\n");
    expect(splitQuoted(reply)).toEqual({
      body: "Bonjour,\n\nParfait, merci !",
      quoted:
        "Le mar. 24 nov. 2026 à 14:02, Devra <contact@exemple.ch> a écrit :\n> Bonjour,\n> voici la maquette.",
    });
    expect(splitQuoted("Juste un message.\n> pas une citation\nsuite")).toEqual({
      body: "Juste un message.\n> pas une citation\nsuite",
      quoted: "",
    });
    expect(splitQuoted("Danke!\n\nAm 24.11.2026 um 14:02 schrieb Devra:\n> Hallo").body).toBe(
      "Danke!",
    );
  });

  it("résume le message sans la partie citée", () => {
    expect(mailExcerpt("Merci\n\nOn Tue, Nov 24 wrote:\n> long", 140)).toBe("Merci");
    expect(mailExcerpt("a".repeat(200), 10)).toBe("aaaaaaaaa…");
  });
});
