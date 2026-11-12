import { describe, expect, it } from "vitest";
import {
  generateLogin,
  generatePassword,
  LOGIN_PATTERN,
  normalizeLogin,
  portalUrl,
} from "@/domain/portal";
import { loginLanguage, portalTexts } from "@/i18n/portal";
import {
  portalChangePasswordSchema,
  portalLoginSchema,
  portalResetSchema,
} from "@/modules/portal/schemas";

describe("identifiants de l'espace client", () => {
  it("génère un identifiant lisible, sans caractère ambigu", () => {
    for (let i = 0; i < 200; i++) {
      const login = generateLogin();
      expect(login).toMatch(LOGIN_PATTERN);
      expect(login).not.toMatch(/[ilo01]/);
    }
  });

  it("génère un mot de passe de 16 caractères en 4 groupes, différent à chaque fois", () => {
    const passwords = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const password = generatePassword();
      expect(password).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
      expect(password).not.toMatch(/[IOilo01]/);
      passwords.add(password);
    }
    expect(passwords.size).toBe(200);
  });

  it("tolère majuscules, espaces et tiret oublié à la saisie de l'identifiant", () => {
    expect(normalizeLogin("k7m3-q9xp")).toBe("k7m3-q9xp");
    expect(normalizeLogin(" K7M3 Q9XP ")).toBe("k7m3-q9xp");
    expect(normalizeLogin("k7m3q9xp")).toBe("k7m3-q9xp");
    // Autre forme : laissée telle quelle (et donc refusée à la connexion).
    expect(normalizeLogin(" Admin@Exemple.ch ")).toBe("admin@exemple.ch");
  });

  it("adresse de l'espace client", () => {
    expect(portalUrl("https://gestion.example.ch/")).toBe(
      "https://gestion.example.ch/espace-client",
    );
  });
});

describe("textes de l'espace client", () => {
  it("le français et l'allemand ont les mêmes clés, sans texte vide", () => {
    const fr = portalTexts("FR");
    const de = portalTexts("DE");
    expect(Object.keys(de).sort()).toEqual(Object.keys(fr).sort());
    for (const texts of [fr, de]) {
      for (const [key, value] of Object.entries(texts)) expect(value, key).not.toBe("");
    }
  });

  it("langue des pages de connexion : paramètre, sinon navigateur", () => {
    expect(loginLanguage("de", "fr-CH")).toBe("DE");
    expect(loginLanguage("fr", "de-CH,de;q=0.9")).toBe("FR");
    expect(loginLanguage(undefined, "de-CH,de;q=0.9")).toBe("DE");
    expect(loginLanguage(undefined, "en-US")).toBe("FR");
    expect(loginLanguage(undefined, null)).toBe("FR");
  });
});

describe("formulaires de l'espace client", () => {
  it("connexion : identifiant et mot de passe obligatoires, langue par défaut", () => {
    expect(portalLoginSchema.safeParse({ login: " ", password: "x" }).success).toBe(false);
    const parsed = portalLoginSchema.parse({ login: "k7m3-q9xp", password: "x", language: "??" });
    expect(parsed.language).toBe("FR");
  });

  it("nouveau mot de passe : longueur minimale et confirmation", () => {
    const base = { token: "t", language: "DE" };
    expect(
      portalResetSchema.safeParse({ ...base, password: "court", passwordConfirm: "court" }).success,
    ).toBe(false);
    const mismatch = portalResetSchema.safeParse({
      ...base,
      password: "assez-long-1",
      passwordConfirm: "assez-long-2",
    });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.path).toEqual(["passwordConfirm"]);
    expect(
      portalChangePasswordSchema.safeParse({
        current: "ancien",
        password: "assez-long-1",
        passwordConfirm: "assez-long-1",
      }).success,
    ).toBe(true);
  });
});
