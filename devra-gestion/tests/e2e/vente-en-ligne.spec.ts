import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, deleteEmailsTo, login, waitForEmail } from "./fixtures";

// Acceptation des devis en ligne : lien envoyé avec le devis, page publique
// (sans compte) en français ou en allemand, acceptation ou refus, notification
// de l'équipe. S'exécute après users.spec.ts (ordre alphabétique).
test.describe.configure({ mode: "serial" });

const FR_CLIENT = { name: "Boutique Lumen Sàrl", email: "achat@lumen.test", search: "lumen" };
const DE_CLIENT = { name: "Weingut Berg AG", email: "info@weingut-berg.test", search: "weingut" };
const CLIENT_IP = "203.0.113.7";

let frQuoteUrl = "";
let frLink = "";

async function newClient(page: Page, client: typeof FR_CLIENT, german = false) {
  await page.goto("/clients/nouveau");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(client.name);
  await page.getByLabel("Email").fill(client.email);
  if (german) {
    await page.getByRole("combobox", { name: "Langue des documents" }).click();
    await page.getByRole("option", { name: "Allemand" }).click();
  }
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name: client.name })).toBeVisible();
}

/** Crée un devis d'une ligne, l'envoie par email et renvoie son numéro et le lien reçu. */
async function sendQuote(page: Page, client: typeof FR_CLIENT, label: string, price: string) {
  await deleteEmailsTo(client.email);
  await page.goto("/devis/nouveau");
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByPlaceholder("Rechercher un client…").fill(client.search);
  await page.getByRole("option", { name: client.name }).click();
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 1").fill(label);
  await page.getByLabel("Prix unitaire de la ligne 1").fill(price);
  await page.getByRole("button", { name: "Créer le devis" }).first().click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  const number = (await page.getByRole("heading", { level: 1 }).textContent())!
    .replace("Devis ", "")
    .trim();

  await page.getByRole("button", { name: "Envoyer par email" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("{lien} sera remplacé à l'envoi par le lien d'acceptation en ligne."),
  ).toBeVisible();
  await expect(dialog.getByLabel("Message")).toHaveValue(/\{lien\}/);
  await dialog.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();

  const email = await waitForEmail(`to:"${client.email}"`, number);
  const link = email.Text.match(/https?:\/\/\S+\/devis-en-ligne\/[A-Za-z0-9_-]{43}/)?.[0];
  expect(link, "lien d'acceptation dans l'email").toBeTruthy();
  return { number, link: link!, email, url: new URL(page.url()).pathname };
}

/** Navigateur du client : sans session, avec sa propre adresse IP. */
async function clientPage(browser: Browser) {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": CLIENT_IP },
  });
  return { context, page: await context.newPage() };
}

test("préparation : entreprise, option activée, deux clients", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/entreprise");
  await page.getByLabel("Nom de l'entreprise").fill("Devra Test");
  await page.getByLabel("Email").fill("contact@devra-test.example");
  await page.getByLabel("Téléphone").fill("021 555 00 00");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de l'entreprise enregistrées.")).toBeVisible();

  await page.goto("/parametres/facturation");
  const option = page.getByLabel("Activer l'acceptation en ligne");
  await expect(option).not.toBeChecked();
  await option.click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres de facturation enregistrés.")).toBeVisible();

  await newClient(page, FR_CLIENT);
  await newClient(page, DE_CLIENT, true);
});

test("le client accepte le devis en ligne ; l'équipe est prévenue", async ({ page, browser }) => {
  await login(page, ADMIN.email, ADMIN.password);
  const sent = await sendQuote(page, FR_CLIENT, "Boutique en ligne", "4200");
  frQuoteUrl = sent.url;
  frLink = sent.link;
  expect(sent.email.Text).toContain("Vous pouvez le consulter et l'accepter en ligne : http");

  const client = await clientPage(browser);
  const pub = client.page;
  await pub.goto(sent.link);
  await expect(pub.getByRole("heading", { name: `Devis ${sent.number}` })).toBeVisible();
  await expect(pub.getByText("Devis de Devra Test")).toBeVisible();
  await expect(pub.getByText(FR_CLIENT.name)).toBeVisible();
  await expect(pub.getByText("Boutique en ligne")).toBeVisible();
  await expect(pub.getByText("CHF 4'200.00").first()).toBeVisible();
  await expect(
    pub.getByText("Une question ? Contactez-nous : contact@devra-test.example"),
  ).toBeVisible();

  // Le PDF est accessible avec le lien, sans compte.
  const pdf = await pub.request.get(`/api/devis-en-ligne/${sent.link.split("/").pop()}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // Nom et case à cocher obligatoires.
  await pub.getByRole("button", { name: "Accepter le devis" }).click();
  await expect(pub.locator("form").getByRole("alert")).toHaveText("Indiquez votre nom et prénom.");
  await pub.getByLabel("Nom et prénom").fill("Jeanne Lumen");
  await pub.getByRole("button", { name: "Accepter le devis" }).click();
  await expect(pub.locator("form").getByRole("alert")).toHaveText(
    "Cochez la case pour accepter le devis.",
  );
  await pub.getByLabel("J'ai lu ce devis et j'en accepte les conditions").check();
  await pub.getByRole("button", { name: "Accepter le devis" }).click();
  await expect(pub.getByRole("status")).toContainText(
    "par Jeanne Lumen. Merci pour votre confiance !",
  );
  await pub.reload();
  await expect(pub.getByRole("button", { name: "Accepter le devis" })).toHaveCount(0);
  await expect(pub.getByRole("status")).toContainText("Devis accepté le");
  await client.context.close();

  const notification = await waitForEmail(
    `to:"${ADMIN.email}"`,
    `Devis ${sent.number} accepté en ligne`,
  );
  expect(notification.Text).toContain("a été accepté en ligne par Jeanne Lumen");
  expect(notification.Text).toContain(`/devis/${sent.url.split("/").pop()}`);

  // Dans l'outil : statut, nom, adresse IP et historique.
  await page.goto(sent.url);
  await expect(page.getByText("Accepté", { exact: true })).toBeVisible();
  await expect(page.getByText("Accepté en ligne")).toBeVisible();
  await expect(page.getByText(/par Jeanne Lumen/)).toBeVisible();
  await expect(page.getByText(`Adresse IP : ${CLIENT_IP}`)).toBeVisible();
  await expect(page.getByText("Jeanne Lumen (client, en ligne)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer la facture" })).toBeVisible();

  // Journal d'activité : la décision est attribuée au client.
  await page.goto(`/parametres/journal?type=devis&q=${sent.number}`);
  await expect(
    page.getByText(`Jeanne Lumen (client, en ligne) a accepté le devis ${sent.number} en ligne`),
  ).toBeVisible();
});

test("en allemand : le client refuse l'offre avec un commentaire", async ({ page, browser }) => {
  await login(page, ADMIN.email, ADMIN.password);
  const sent = await sendQuote(page, DE_CLIENT, "Webshop", "3000");
  expect(sent.email.Text).toContain("Sie können die Offerte online ansehen und annehmen: http");

  const client = await clientPage(browser);
  const pub = client.page;
  await pub.goto(sent.link);
  await expect(pub.getByRole("heading", { name: `Offerte ${sent.number}` })).toBeVisible();
  await pub.getByRole("button", { name: "Ich möchte diese Offerte nicht annehmen" }).click();
  await pub.getByLabel("Vor- und Nachname").fill("Hans Berg");
  await pub.getByLabel("Kommentar (optional)").fill("Zu teuer für uns.");
  await pub.getByRole("button", { name: "Offerte ablehnen" }).click();
  await expect(pub.getByRole("status")).toContainText("Diese Offerte wurde am");
  await expect(pub.getByRole("status")).toContainText("abgelehnt.");
  await client.context.close();

  const notification = await waitForEmail(
    `to:"${ADMIN.email}"`,
    `Devis ${sent.number} refusé en ligne`,
  );
  expect(notification.Text).toContain("Commentaire du client : Zu teuer für uns.");
  await page.goto(sent.url);
  await expect(page.getByText("Refusé", { exact: true })).toBeVisible();
  await expect(page.getByText("« Zu teuer für uns. »").first()).toBeVisible();
});

test("lien inconnu, puis option désactivée : plus d'accès au devis", async ({ page, browser }) => {
  const client = await clientPage(browser);
  await client.page.goto(`/devis-en-ligne/${"x".repeat(43)}`);
  await expect(client.page.getByRole("heading", { name: "Lien non valable" })).toBeVisible();
  await expect(client.page.getByRole("heading", { name: "Ungültiger Link" })).toBeVisible();

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/facturation");
  await page.getByLabel("Activer l'acceptation en ligne").click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres de facturation enregistrés.")).toBeVisible();

  await client.page.goto(frLink);
  await expect(client.page.getByRole("heading", { name: "Lien non valable" })).toBeVisible();
  await client.context.close();

  // Sans l'option, la phrase du lien disparaît du message proposé.
  await page.goto(frQuoteUrl);
  await page.getByRole("button", { name: "Envoyer par email" }).click();
  await expect(page.getByRole("dialog").getByLabel("Message")).not.toHaveValue(/en ligne/);
});
