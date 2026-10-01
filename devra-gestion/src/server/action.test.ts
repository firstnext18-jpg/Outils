import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CurrentUser } from "@/server/session";

// La session est simulée : on vérifie ici la logique du point d'entrée des actions.
const getCurrentUser = vi.fn<() => Promise<CurrentUser | null>>();
vi.mock("@/server/session", () => ({ getCurrentUser: () => getCurrentUser() }));

const { authAction, publicAction, UserError } = await import("@/server/action");

const member: CurrentUser = { id: "u1", name: "Léa", email: "lea@example.ch", role: "MEMBER" };
const reader: CurrentUser = { ...member, id: "u2", role: "READONLY" };

const schema = z.object({ name: z.string().min(1, "Nom obligatoire") });

describe("authAction", () => {
  const handler = vi.fn(async (input: { name: string }) => `Bonjour ${input.name}`);
  const action = authAction({ role: "MEMBER", schema }, handler);

  beforeEach(() => {
    handler.mockClear();
  });

  it("refuse un utilisateur non connecté", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await action({ name: "x" })).toEqual({
      ok: false,
      error: "Votre session a expiré. Reconnectez-vous.",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuse un rôle insuffisant, sans exécuter l'action", async () => {
    getCurrentUser.mockResolvedValue(reader);
    const result = await action({ name: "x" });
    expect(result.ok).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("valide les données avec Zod", async () => {
    getCurrentUser.mockResolvedValue(member);
    const result = await action({ name: "" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { name: ["Nom obligatoire"] } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("exécute l'action et renvoie son résultat", async () => {
    getCurrentUser.mockResolvedValue(member);
    expect(await action({ name: "Léa" })).toEqual({ ok: true, data: "Bonjour Léa" });
    expect(handler).toHaveBeenCalledWith({ name: "Léa" }, { user: member });
  });

  it("affiche le message d'une erreur métier", async () => {
    getCurrentUser.mockResolvedValue(member);
    const failing = authAction({ role: "MEMBER", schema }, async () => {
      throw new UserError("Ce client a des factures.");
    });
    expect(await failing({ name: "x" })).toEqual({ ok: false, error: "Ce client a des factures." });
  });

  it("masque le détail d'une erreur inattendue", async () => {
    getCurrentUser.mockResolvedValue(member);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = authAction({ role: "MEMBER", schema }, async () => {
      throw new Error("connexion base perdue");
    });
    const result = await failing({ name: "x" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).not.toContain("base");
  });
});

describe("publicAction", () => {
  it("valide les données sans exiger de session", async () => {
    getCurrentUser.mockResolvedValue(null);
    const action = publicAction({ schema }, async ({ name }) => name.length);
    expect(await action({ name: "abc" })).toEqual({ ok: true, data: 3 });
    expect((await action({ name: "" })).ok).toBe(false);
  });
});
