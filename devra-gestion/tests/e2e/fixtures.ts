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

export type MailpitMessage = {
  Subject: string;
  Text: string;
  To: { Address: string }[];
  Bcc: { Address: string }[];
  ReplyTo: { Address: string }[];
  Attachments: { FileName: string; ContentType: string; Size: number }[];
};

/**
 * Attend l'email le plus récent correspondant à la recherche Mailpit
 * (ex. `to:"client@exemple.ch"`, `bcc:"admin@exemple.ch"`) et renvoie son contenu.
 */
export async function waitForEmail(
  query: string,
  subjectContains: string,
): Promise<MailpitMessage> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`);
    const { messages } = (await search.json()) as { messages: MailpitSummary[] };
    const message = messages.find((m) => m.Subject.includes(subjectContains));
    if (message) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
      return (await detail.json()) as MailpitMessage;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Aucun email « ${subjectContains} » pour ${query}`);
}

/**
 * Simule un refus du serveur SMTP pour tous les destinataires (mode « chaos »
 * de Mailpit, activé dans compose.dev.yaml).
 */
export async function setSmtpFailure(enabled: boolean) {
  const response = await fetch(`${MAILPIT_URL}/api/v1/chaos`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Recipient: { ErrorCode: 451, Probability: enabled ? 100 : 0 } }),
  });
  if (!response.ok) throw new Error("Mode chaos de Mailpit indisponible (MP_ENABLE_CHAOS)");
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

/** L'admin (déjà connecté) invite une personne avec le rôle indiqué. */
export async function invite(
  page: Page,
  person: { name: string; email: string },
  roleLabel: string,
) {
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

/** La personne invitée active son compte depuis le lien reçu par email. */
export async function acceptInvitation(page: Page, person: { email: string; password: string }) {
  const link = await waitForEmailLink(person.email, "Invitation");
  await switchToFreshIp(page);
  await page.goto(link);
  await expect(page.getByLabel("Email")).toHaveValue(person.email);
  await page.getByLabel("Nouveau mot de passe").fill(person.password);
  await page.getByLabel("Confirmation").fill(person.password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL("/");
}
