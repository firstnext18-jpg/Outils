import { describe, expect, it } from "vitest";
import { canEdit, hasRole, isAdmin } from "@/domain/roles";

describe("hasRole", () => {
  it("l'admin a tous les droits", () => {
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("ADMIN", "MEMBER")).toBe(true);
    expect(hasRole("ADMIN", "READONLY")).toBe(true);
  });

  it("le membre modifie les données mais n'accède pas aux paramètres", () => {
    expect(hasRole("MEMBER", "ADMIN")).toBe(false);
    expect(hasRole("MEMBER", "MEMBER")).toBe(true);
    expect(hasRole("MEMBER", "READONLY")).toBe(true);
  });

  it("la lecture seule ne fait que consulter", () => {
    expect(hasRole("READONLY", "ADMIN")).toBe(false);
    expect(hasRole("READONLY", "MEMBER")).toBe(false);
    expect(hasRole("READONLY", "READONLY")).toBe(true);
  });
});

describe("raccourcis", () => {
  it("canEdit et isAdmin", () => {
    expect([canEdit("ADMIN"), canEdit("MEMBER"), canEdit("READONLY")]).toEqual([true, true, false]);
    expect([isAdmin("ADMIN"), isAdmin("MEMBER"), isAdmin("READONLY")]).toEqual([
      true,
      false,
      false,
    ]);
  });
});
