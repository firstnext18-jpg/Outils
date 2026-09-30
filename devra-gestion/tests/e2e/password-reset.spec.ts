import { expect, test } from "@playwright/test";
import {
  ADMIN,
  deleteEmailsTo,
  login,
  logout,
  switchToFreshIp,
  waitForEmailLink,
} from "./fixtures";

test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.0.3.1" } });
test.describe.configure({ mode: "serial" });

const PERSON = { name: "Nora Oubli", email: "nora@e2e.test", password: "Nora-Password-2026" };
const NEW_PASSWORD = "Nora-Nouveau-2026";

test("préparation : l'admin invite Nora qui active son compte", async ({ page }) => {
  await deleteEmailsTo(PERSON.email);
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/utilisateurs");
  await page.getByRole("button", { name: "Inviter" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom complet").fill(PERSON.name);
  await dialog.getByLabel("Email").fill(PERSON.email);
  await dialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByText(`Invitation envoyée à ${PERSON.email}.`)).toBeVisible();
  await logout(page);

  await switchToFreshIp(page);
  await page.goto(await waitForEmailLink(PERSON.email, "Invitation"));
  await page.getByLabel("Nouveau mot de passe").fill(PERSON.password);
  await page.getByLabel("Confirmation").fill(PERSON.password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL("/");
  await logout(page);
});

test("mot de passe oublié : email, nouveau mot de passe, connexion", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await page.getByLabel("Email").fill(PERSON.email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("status")).toContainText(PERSON.email);

  await page.goto(await waitForEmailLink(PERSON.email, "Réinitialisation"));
  await expect(page).toHaveURL(/\/reinitialiser\?token=/);
  await page.getByLabel("Nouveau mot de passe").fill(NEW_PASSWORD);
  await page.getByLabel("Confirmation").fill("pas-le-meme-mot-de-passe");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Les deux mots de passe ne correspondent pas")).toBeVisible();

  await page.getByLabel("Confirmation").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page).toHaveURL("/connexion?reinitialise=1");
  await expect(page.getByText("Votre mot de passe a été modifié.")).toBeVisible();

  await login(page, PERSON.email, NEW_PASSWORD);
});

test("un lien de réinitialisation déjà utilisé est refusé", async ({ page }) => {
  await page.goto(await waitForEmailLink(PERSON.email, "Réinitialisation"));
  await expect(page.getByText("Lien invalide ou expiré")).toBeVisible();
});
