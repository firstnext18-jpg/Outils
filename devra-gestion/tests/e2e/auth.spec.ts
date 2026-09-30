import { expect, test } from "@playwright/test";
import { ADMIN, formAlert, login, logout } from "./fixtures";

// Adresse IP propre à ce fichier : la limitation des tentatives est comptée par IP.
test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.0.1.1" } });

test("une page protégée redirige vers la connexion", async ({ page }) => {
  await page.goto("/clients");
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fclients$/);
  await expect(page.getByText("Connexion", { exact: true })).toBeVisible();
});

test("un mauvais mot de passe affiche une erreur", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(formAlert(page)).toHaveText("Email ou mot de passe incorrect.");
});

test("l'admin se connecte, voit les paramètres puis se déconnecte", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page.getByRole("heading", { name: "Bonjour Admin" })).toBeVisible();
  await page.getByRole("link", { name: "Paramètres" }).click();
  await expect(page.getByRole("heading", { name: "Paramètres" })).toBeVisible();
  await logout(page);
  // Après déconnexion, les pages protégées ne sont plus accessibles.
  await page.goto("/parametres/entreprise");
  await expect(page).toHaveURL(/\/connexion/);
});

test("après la connexion, on revient à la page demandée", async ({ page }) => {
  await page.goto("/devis");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(ADMIN.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/devis");
});

test.describe("limitation des tentatives", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.0.1.99" } });

  test("bloque après 5 essais en une minute", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill(ADMIN.email);
    const password = page.getByLabel("Mot de passe", { exact: true });
    const submit = page.getByRole("button", { name: "Se connecter" });
    for (let attempt = 1; attempt <= 5; attempt++) {
      await password.fill(`faux-${attempt}`);
      await submit.click();
      await expect(formAlert(page)).toHaveText("Email ou mot de passe incorrect.");
    }
    // 6e essai, même avec le bon mot de passe : refusé.
    await password.fill(ADMIN.password);
    await submit.click();
    await expect(formAlert(page)).toContainText("Trop de tentatives");
  });
});
