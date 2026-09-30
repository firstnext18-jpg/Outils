import { expect, test, type Page } from "@playwright/test";
import {
  ADMIN,
  deleteEmailsTo,
  formAlert,
  login,
  logout,
  switchToFreshIp,
  waitForEmailLink,
} from "./fixtures";

test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.0.2.1" } });

// Les tests de ce fichier s'enchaînent : invitation → activation → droits.
test.describe.configure({ mode: "serial" });

const MEMBER = { name: "Léa Membre", email: "lea@e2e.test", password: "Lea-Password-2026" };
const READER = { name: "Marc Lecteur", email: "marc@e2e.test", password: "Marc-Password-2026" };

async function invite(page: Page, person: { name: string; email: string }, roleLabel: string) {
  await deleteEmailsTo(person.email);
  await page.goto("/parametres/utilisateurs");
  await page.getByRole("button", { name: "Inviter" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom complet").fill(person.name);
  await dialog.getByLabel("Email").fill(person.email);
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: new RegExp(`^${roleLabel}`) }).click();
  await dialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(page.getByText(`Invitation envoyée à ${person.email}.`)).toBeVisible();
}

async function acceptInvitation(page: Page, person: { email: string; password: string }) {
  const link = await waitForEmailLink(person.email, "Invitation");
  await switchToFreshIp(page);
  await page.goto(link);
  await expect(page.getByLabel("Email")).toHaveValue(person.email);
  await page.getByLabel("Nouveau mot de passe").fill(person.password);
  await page.getByLabel("Confirmation").fill(person.password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL("/");
}

test("l'admin invite un membre et un utilisateur en lecture seule", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await invite(page, MEMBER, "Membre");
  await invite(page, READER, "Lecture seule");
  await expect(page.getByText("Invitations en attente")).toBeVisible();
  await expect(page.getByRole("cell", { name: new RegExp(MEMBER.email) })).toBeVisible();
});

test("une adresse déjà utilisée ne peut pas être invitée", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/utilisateurs");
  await page.getByRole("button", { name: "Inviter" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom complet").fill("Doublon");
  await dialog.getByLabel("Email").fill(ADMIN.email);
  await dialog.getByRole("button", { name: "Envoyer l'invitation" }).click();
  await expect(formAlert(page)).toHaveText("Un utilisateur avec cette adresse email existe déjà.");
});

test("le membre active son compte et n'a pas accès aux paramètres", async ({ page }) => {
  await acceptInvitation(page, MEMBER);
  await expect(page.getByRole("link", { name: "Clients" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Paramètres" })).toHaveCount(0);
  await page.goto("/parametres/utilisateurs");
  await expect(page).toHaveURL("/acces-refuse");
  await expect(page.getByText("Accès refusé")).toBeVisible();
});

test("un lien d'invitation ne sert qu'une fois", async ({ page }) => {
  const link = await waitForEmailLink(MEMBER.email, "Invitation");
  await page.goto(link);
  await expect(page.getByText("Cette invitation a déjà été utilisée.")).toBeVisible();
});

test("l'utilisateur en lecture seule active son compte", async ({ page }) => {
  await acceptInvitation(page, READER);
  await expect(page.getByRole("link", { name: "Paramètres" })).toHaveCount(0);
  await page.goto("/parametres/entreprise");
  await expect(page).toHaveURL("/acces-refuse");
});

test("l'admin change un rôle, puis désactive un compte", async ({ page, browser }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/utilisateurs");
  const readerRow = page.getByRole("row", { name: new RegExp(READER.email) });
  await readerRow.getByRole("combobox", { name: `Rôle de ${READER.name}` }).click();
  await page.getByRole("option", { name: "Membre" }).click();
  await expect(page.getByText(`${READER.name} est maintenant « Membre ».`)).toBeVisible();

  // Le membre se connecte dans un autre navigateur…
  const memberContext = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "10.0.2.2" },
  });
  const memberPage = await memberContext.newPage();
  await login(memberPage, MEMBER.email, MEMBER.password);

  // …puis l'admin le désactive : il est déconnecté immédiatement.
  const memberRow = page.getByRole("row", { name: new RegExp(MEMBER.email) });
  await memberRow.getByRole("button", { name: "Désactiver" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Désactiver" }).click();
  await expect(page.getByText(`${MEMBER.name} est désactivé.`)).toBeVisible();

  await memberPage.goto("/clients");
  await expect(memberPage).toHaveURL(/\/connexion/);
  await switchToFreshIp(memberPage);
  await memberPage.getByLabel("Email").fill(MEMBER.email);
  await memberPage.getByLabel("Mot de passe", { exact: true }).fill(MEMBER.password);
  await memberPage.getByRole("button", { name: "Se connecter" }).click();
  await expect(formAlert(memberPage)).toHaveText(
    "Ce compte est désactivé. Contactez un administrateur.",
  );
  await memberContext.close();
});

test("l'admin ne peut pas se désactiver lui-même", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/utilisateurs");
  const selfRow = page.getByRole("row", { name: /\(vous\)/ });
  await expect(selfRow.getByRole("button", { name: "Désactiver" })).toHaveCount(0);
  await logout(page);
});
