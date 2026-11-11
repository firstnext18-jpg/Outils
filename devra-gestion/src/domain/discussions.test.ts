import { describe, expect, it } from "vitest";
import {
  isGeneralDiscussion,
  messageExcerpt,
  messageParts,
  nameInitials,
} from "@/domain/discussions";
import { createDiscussionSchema, postMessageSchema } from "@/modules/discussions/schemas";

describe("discussions", () => {
  it("reconnaît le canal général", () => {
    expect(isGeneralDiscussion("general")).toBe(true);
    expect(isGeneralDiscussion("0199a1b2-0000-7000-8000-000000000000")).toBe(false);
  });

  it("résume un message sur une ligne", () => {
    expect(messageExcerpt("Bonjour,\n\n  on part sur le thème clair ?")).toBe(
      "Bonjour, on part sur le thème clair ?",
    );
    expect(messageExcerpt("a".repeat(200), 20)).toBe(`${"a".repeat(19)}…`);
  });

  it("donne les initiales d'un nom", () => {
    expect(nameInitials("Léa Martin")).toBe("LM");
    expect(nameInitials("  jean  ")).toBe("J");
  });

  it("repère les adresses web d'un message", () => {
    expect(messageParts("Voir https://exemple.ch/maquette, puis valider.")).toEqual([
      { text: "Voir " },
      { text: "https://exemple.ch/maquette", url: "https://exemple.ch/maquette" },
      { text: ", puis valider." },
    ]);
    expect(messageParts("Sans lien")).toEqual([{ text: "Sans lien" }]);
  });

  it("valide une nouvelle discussion et un message", () => {
    const ok = createDiscussionSchema.safeParse({
      clientId: "0199a1b2-0000-7000-8000-000000000000",
      title: "  Choix du thème ",
      body: "On part sur le clair ?",
    });
    expect(ok.success && ok.data.title).toBe("Choix du thème");
    const empty = postMessageSchema.safeParse({ discussionId: "general", body: "   " });
    expect(empty.error?.issues[0]?.message).toBe("Écrivez un message");
    expect(postMessageSchema.safeParse({ discussionId: "../x", body: "a" }).success).toBe(false);
  });
});
