import { expect, type Page } from "@playwright/test";

export const ADMIN = {
  name: "Admin Test",
  email: "admin@e2e.test",
  password: "Admin-E2E-Password",
};

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

type MailpitSummary = { ID: string; Subject: string };

/**
 * Attend l'email le plus récent reçu par `to` dans Mailpit et renvoie le
 * premier lien http(s) qu'il contient.
 */
export async function waitForEmailLink(to: string, subjectContains: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    const { messages } = (await search.json()) as { messages: MailpitSummary[] };
    const message = messages.find((m) => m.Subject.includes(subjectContains));
    if (message) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
      const { Text } = (await detail.json()) as { Text: string };
      const link = Text.match(/https?:\/\/\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Aucun email « ${subjectContains} » reçu par ${to}`);
}

export async function deleteEmailsTo(to: string) {
  await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`, {
    method: "DELETE",
  });
}

/** Message d'erreur d'un formulaire (et non l'annonceur de navigation de Next.js). */
export function formAlert(page: Page) {
  return page.locator('[data-slot="alert"]');
}

/**
 * La limitation des tentatives compte les connexions par adresse IP (5 par
 * minute). Chaque connexion de test utilise donc une adresse différente, sauf
 * dans le test qui vérifie justement cette limitation.
 */
let ipCounter = 0;
export async function switchToFreshIp(page: Page) {
  ipCounter += 1;
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`,
  });
}

export async function login(page: Page, email: string, password: string) {
  await switchToFreshIp(page);
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/");
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Menu utilisateur" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
}
