import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  ADMIN,
  deleteEmailsTo,
  formAlert,
  login,
  switchToFreshIp,
  waitForEmail,
  waitForEmailLink,
} from "./fixtures";

// Espace client : accès créé depuis la fiche (identifiant et mot de passe
// générés), devis, factures et abonnements du client, réponse aux devis,
// discussion avec l'équipe (sans jamais voir les discussions internes),
// mot de passe changé, oublié, régénéré, accès désactivé.
// S'exécute en dernier (ordre alphabétique) : les documents créés ici ne
// décalent pas la numérotation vérifiée par les autres tests.
test.describe.configure({ mode: "serial" });

const CLIENT = {
  name: "Atelier Portail SA",
  contact: "Lucie Portail",
  email: "lucie@atelier-portail.test",
  search: "atelier portail",
};
const OTHER = {
  name: "Konkurrent Portal GmbH",
  email: "info@konkurrent.test",
  search: "konkurrent",
};

let clientUrl = "";
let credentials = { login: "", password: "" };
let sentQuoteUrl = "";
let draftQuoteNumber = "";
let otherQuoteId = "";
let invoiceNumber = "";
let invoiceId = "";
let sentQuoteNumber = "";

async function newClient(page: Page, client: { name: string; email: string }, german = false) {
  await page.goto("/clients/nouveau");
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(client.name);
  if (client === CLIENT) await page.getByLabel("Personne de contact").fill(CLIENT.contact);
  await page.getByLabel("Email").fill(client.email);
  if (german) {
    await page.getByRole("combobox", { name: "Langue des documents" }).click();
    await page.getByRole("option", { name: "Allemand" }).click();
  }
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name: client.name })).toBeVisible();
  return new URL(page.url()).pathname;
}

async function otherAction(page: Page, name: string) {
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name }).click();
}

async function pickClient(page: Page, client: { name: string; search: string }) {
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByPlaceholder("Rechercher un client…").fill(client.search);
  await page.getByRole("option", { name: client.name }).click();
}

/** Devis d'une ligne (brouillon, ou marqué comme envoyé) : numéro et adresse. */
async function newQuote(
  page: Page,
  client: { name: string; search: string },
  label: string,
  sent: boolean,
) {
  await page.goto("/devis/nouveau");
  await page.waitForLoadState("networkidle");
  await pickClient(page, client);
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 1").fill(label);
  await page.getByLabel("Prix unitaire de la ligne 1").fill("2400");
  await page.getByRole("button", { name: "Créer le devis" }).first().click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  const number = (await page.getByRole("heading", { level: 1 }).textContent())!
    .replace("Devis ", "")
    .trim();
  if (sent) {
    await otherAction(page, "Marquer comme envoyé");
    await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();
  }
  return { number, url: new URL(page.url()).pathname };
}

/** Navigateur du client : sans session de l'équipe, avec sa propre adresse IP. */
async function clientBrowser(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await switchToFreshIp(page);
  return { context, page };
}

async function portalLogin(page: Page, login: string, password: string) {
  await switchToFreshIp(page);
  await page.goto("/espace-client/connexion?langue=fr");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Identifiant").fill(login);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

const credentialsDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Identifiants de l'espace client" });

async function readCredentials(page: Page) {
  const dialog = credentialsDialog(page);
  await expect(dialog).toBeVisible();
  const login = (await dialog.getByText(/^[a-z0-9]{4}-[a-z0-9]{4}$/).textContent())!.trim();
  const password = (await dialog
    .getByText(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/)
    .textContent())!.trim();
  return { login, password };
}

test("préparation : deux clients, devis, facture émise et discussion interne", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  clientUrl = await newClient(page, CLIENT);
  await newClient(page, OTHER, true);

  const sent = await newQuote(page, CLIENT, "Refonte du site", true);
  sentQuoteNumber = sent.number;
  sentQuoteUrl = sent.url;
  draftQuoteNumber = (await newQuote(page, CLIENT, "Idée en cours", false)).number;
  otherQuoteId = (await newQuote(page, OTHER, "Webshop", true)).url.split("/").pop()!;

  await page.goto("/factures/nouvelle");
  await page.waitForLoadState("networkidle");
  await pickClient(page, CLIENT);
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 1").fill("Acompte maquettes");
  await page.getByLabel("Prix unitaire de la ligne 1").fill("850");
  await page.getByRole("button", { name: "Créer le brouillon" }).first().click();
  await expect(page.getByText("Brouillon de facture enregistré.")).toBeVisible();
  await otherAction(page, "Émettre sans envoyer");
  await page.getByRole("alertdialog").getByRole("button", { name: "Émettre" }).click();
  await expect(page.getByText(/^Facture F-\d{4}-\d{3} émise\.$/)).toBeVisible();
  invoiceNumber = (await page.getByRole("heading", { level: 1 }).textContent())!
    .replace("Facture ", "")
    .trim();
  invoiceId = new URL(page.url()).pathname.split("/").pop()!;

  // Discussion interne de l'équipe sur ce client : le client ne doit jamais la voir.
  await page.goto(`/discussions/nouvelle?client=${clientUrl.split("/").pop()}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Sujet").fill("Marge sur le projet");
  await page.getByLabel("Message").fill("Note interne : marge à négocier.");
  await page.getByRole("button", { name: "Démarrer la discussion" }).click();
  await expect(page.getByRole("heading", { name: "Marge sur le projet" })).toBeVisible();
});

test("l'équipe crée l'accès : identifiants affichés une fois, puis envoyés par email", async ({
  page,
}) => {
  await deleteEmailsTo(CLIENT.email);
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(clientUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Ce client n'a pas encore d'accès.")).toBeVisible();
  await page.getByRole("button", { name: "Créer l'accès à l'espace client" }).click();
  credentials = await readCredentials(page);

  const dialog = credentialsDialog(page);
  await expect(dialog.getByText("le mot de passe ne sera plus affiché")).toBeVisible();
  await expect(dialog.getByText(/\/espace-client$/)).toBeVisible();
  await dialog.getByRole("button", { name: `Envoyer par email à ${CLIENT.email}` }).click();
  await expect(dialog.getByRole("button", { name: `Envoyé à ${CLIENT.email}` })).toBeDisabled();
  await dialog.getByRole("button", { name: "Terminé" }).click();

  const email = await waitForEmail(`to:"${CLIENT.email}"`, "Votre accès à l'espace client");
  expect(email.Text).toContain(`Identifiant : ${credentials.login}`);
  expect(email.Text).toContain(`Mot de passe : ${credentials.password}`);
  expect(email.Text).toContain("/espace-client/connexion");

  // La fiche montre l'accès, jamais le mot de passe.
  await expect(page.getByText(credentials.login, { exact: true })).toBeVisible();
  await expect(page.getByText("Actif", { exact: true })).toBeVisible();
  await expect(page.getByText("Jamais", { exact: true })).toBeVisible();
  await expect(page.getByText(credentials.password)).toHaveCount(0);
  await expect(page.getByText(/a créé l'accès à l'espace client/)).toBeVisible();

  // La discussion avec le client apparaît chez l'équipe, signalée comme visible par lui.
  await page.goto("/discussions");
  await page.waitForLoadState("networkidle");
  const item = page
    .getByRole("list", { name: "Discussions" })
    .getByRole("listitem")
    .filter({ hasText: "Discussion avec le client" })
    .filter({ hasText: CLIENT.name });
  await expect(item).toContainText("Visible par le client");
});

test("le client se connecte et voit ses documents, sans les brouillons", async ({ browser }) => {
  const { context, page } = await clientBrowser(browser);
  // Sans session : renvoyé à la connexion de l'espace client (pas à celle de l'équipe).
  await page.goto("/espace-client/factures");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/espace-client\/connexion/);

  await portalLogin(page, credentials.login, "mauvais-mot-de-passe");
  await expect(formAlert(page)).toHaveText("Identifiant ou mot de passe incorrect.");
  // L'identifiant se saisit aussi en majuscules.
  await portalLogin(page, credentials.login.toUpperCase(), credentials.password);
  await expect(page).toHaveURL("/espace-client");
  await expect(page.getByRole("heading", { name: `Bonjour ${CLIENT.contact}` })).toBeVisible();

  // À payer : la facture émise, avec ses informations de paiement.
  const toPay = page.getByRole("list", { name: "À payer" });
  await expect(toPay).toContainText(`Facture ${invoiceNumber}`);
  await expect(toPay).toContainText("CHF 850.00");
  await expect(toPay).toContainText("Référence");
  await expect(page.getByText("Total à payer")).toBeVisible();

  // Devis en attente de réponse ; le brouillon n'apparaît nulle part.
  await expect(page.getByText("Devis en attente de votre réponse")).toBeVisible();
  await page.getByRole("link", { name: "Devis", exact: true }).click();
  const quotes = page.getByRole("list", { name: "Devis" });
  await expect(quotes).toContainText(`Devis ${sentQuoteNumber}`);
  await expect(quotes).toContainText("En attente de votre réponse");
  await expect(page.getByText(draftQuoteNumber)).toHaveCount(0);

  // PDF : les siens oui, ceux d'un autre client ou de l'outil de gestion non.
  const ownQuote = sentQuoteUrl.split("/").pop();
  expect((await page.request.get(`/api/espace-client/devis/${ownQuote}/pdf`)).status()).toBe(200);
  const invoicePdf = await page.request.get(`/api/espace-client/factures/${invoiceId}/pdf`);
  expect(invoicePdf.status()).toBe(200);
  expect(invoicePdf.headers()["content-type"]).toBe("application/pdf");
  expect((await page.request.get(`/api/espace-client/devis/${otherQuoteId}/pdf`)).status()).toBe(
    404,
  );
  expect((await page.request.get(`/api/devis/${ownQuote}/pdf`)).status()).toBe(401);
  const otherPage = await page.goto(`/espace-client/devis/${otherQuoteId}`);
  expect(otherPage?.status()).toBe(404);

  // La session du client n'ouvre pas l'outil de gestion.
  await page.goto("/clients");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fclients/);
  await context.close();
});

test("le client accepte un devis depuis son espace ; l'équipe est prévenue", async ({
  page,
  browser,
}) => {
  await deleteEmailsTo(ADMIN.email);
  const client = await clientBrowser(browser);
  await portalLogin(client.page, credentials.login, credentials.password);
  // Connexion terminée (cookie posé) avant d'ouvrir une autre page.
  await expect(client.page).toHaveURL("/espace-client");
  await client.page.goto("/espace-client/devis");
  await client.page.waitForLoadState("networkidle");
  await client.page.getByRole("link", { name: new RegExp(sentQuoteNumber) }).click();
  await expect(client.page.getByText("Refonte du site")).toBeVisible();
  await client.page.getByLabel("Nom et prénom").fill(CLIENT.contact);
  await client.page.getByLabel("J'ai lu ce devis et j'en accepte les conditions").check();
  await client.page.getByRole("button", { name: "Accepter le devis" }).click();
  await expect(client.page.getByRole("status")).toContainText(`par ${CLIENT.contact}`);
  await client.context.close();

  const notification = await waitForEmail(
    `to:"${ADMIN.email}"`,
    `Devis ${sentQuoteNumber} accepté depuis l'espace client`,
  );
  expect(notification.Text).toContain(`accepté depuis l'espace client par ${CLIENT.contact}`);

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(sentQuoteUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Accepté", { exact: true })).toBeVisible();
  await expect(page.getByText(`${CLIENT.contact} (client, espace client)`)).toBeVisible();
});

test("discussion client ↔ équipe : messages, email, accusés de lecture, rien d'interne", async ({
  page,
  browser,
}) => {
  await deleteEmailsTo(CLIENT.email);
  const client = await clientBrowser(browser);
  await portalLogin(client.page, credentials.login, credentials.password);
  // Connexion terminée (cookie posé) avant d'ouvrir une autre page.
  await expect(client.page).toHaveURL("/espace-client");
  await client.page.getByRole("link", { name: "Discussion" }).click();
  await expect(client.page.getByText("Aucun message pour l'instant. Écrivez-nous !")).toBeVisible();
  // Les discussions internes ne sont jamais visibles du client.
  await expect(client.page.getByText("marge à négocier")).toHaveCount(0);
  await client.page.getByLabel("Votre message").fill("Bonjour, quand commence le projet ?");
  await client.page.getByLabel("Votre message").press("Enter");
  const clientThread = client.page.getByRole("list", { name: "Messages" });
  await expect(clientThread).toContainText("Bonjour, quand commence le projet ?");
  await expect(clientThread).toContainText("Vous");
  await expect(client.page.getByText("Pas encore lu")).toBeVisible();

  // L'équipe lit et répond.
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/discussions");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("list", { name: "Discussions" })
    .getByRole("listitem")
    .filter({ hasText: CLIENT.name })
    .filter({ hasText: "Discussion avec le client" })
    .getByRole("link")
    .click();
  await expect(
    page.getByText("Le client lit cette discussion dans son espace client"),
  ).toBeVisible();
  const thread = page.getByRole("list", { name: "Messages" });
  await expect(thread).toContainText("Bonjour, quand commence le projet ?");
  await expect(thread).toContainText(CLIENT.name);
  await expect(thread.getByText("Client", { exact: true })).toBeVisible();
  await page.getByLabel("Votre message").fill("Lundi prochain, avec les maquettes !");
  await page.getByLabel("Votre message").press("Enter");
  await expect(thread).toContainText("Lundi prochain, avec les maquettes !");

  const email = await waitForEmail(
    `to:"${CLIENT.email}"`,
    "Nouveau message dans votre espace client",
  );
  expect(email.Text).toContain(`${ADMIN.name} vous a écrit dans votre espace client`);
  expect(email.Text).toContain("Lundi prochain, avec les maquettes !");
  expect(email.Text).toContain("/espace-client/discussion");

  // Le fil du client se met à jour seul : réponse reçue, son message lu par l'équipe.
  await expect(clientThread).toContainText("Lundi prochain, avec les maquettes !", {
    timeout: 15_000,
  });
  await expect(clientThread).toContainText(ADMIN.name);
  await expect(client.page.getByText("Lu par l'équipe")).toBeVisible();
  // Et l'équipe voit que le client a lu sa réponse.
  await expect(page.getByText(`Lu par ${CLIENT.name} (client)`)).toBeVisible({ timeout: 15_000 });
  await client.context.close();
});

test("mot de passe : changé par le client, puis oublié", async ({ browser }) => {
  const { context, page } = await clientBrowser(browser);
  await portalLogin(page, credentials.login, credentials.password);
  // Connexion terminée (cookie posé) avant d'ouvrir une autre page.
  await expect(page).toHaveURL("/espace-client");
  await page.getByRole("link", { name: "Mon compte" }).click();
  await expect(page.getByText(credentials.login, { exact: true })).toBeVisible();

  await page.getByLabel("Mot de passe actuel").fill("pas-le-bon");
  await page.getByLabel("Nouveau mot de passe").fill("Lucie-Nouveau-2026");
  await page.getByLabel("Confirmation").fill("Lucie-Nouveau-2026");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(formAlert(page)).toHaveText("Le mot de passe actuel est incorrect.");
  await page.getByLabel("Mot de passe actuel").fill(credentials.password);
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Votre mot de passe a été modifié.")).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/espace-client\/connexion/);
  await portalLogin(page, credentials.login, credentials.password);
  await expect(formAlert(page)).toHaveText("Identifiant ou mot de passe incorrect.");
  await portalLogin(page, credentials.login, "Lucie-Nouveau-2026");
  await expect(page).toHaveURL("/espace-client");
  await page.getByRole("button", { name: "Se déconnecter" }).click();

  // Mot de passe oublié : lien reçu à l'adresse de la fiche client.
  await deleteEmailsTo(CLIENT.email);
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await page.getByLabel("Identifiant ou email").fill(CLIENT.email.toUpperCase());
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(
    page.getByText("Si un accès correspond, un email vient de vous être envoyé."),
  ).toBeVisible();
  const link = await waitForEmailLink(
    CLIENT.email,
    "Nouveau mot de passe pour votre espace client",
  );
  expect(link).toMatch(/\/espace-client\/reinitialiser\/[A-Za-z0-9_-]{43}$/);
  await page.goto(link);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(credentials.login)).toBeVisible();
  await page.getByLabel("Nouveau mot de passe").fill("Lucie-Oubli-2026");
  await page.getByLabel("Confirmation").fill("Lucie-Oubli-2026");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByText("Votre mot de passe a été modifié. Connectez-vous")).toBeVisible();
  // Lien à usage unique.
  await page.goto(link);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Ce lien n'est pas valable ou a expiré.")).toBeVisible();
  await portalLogin(page, credentials.login, "Lucie-Oubli-2026");
  await expect(page).toHaveURL("/espace-client");
  credentials.password = "Lucie-Oubli-2026";
  await context.close();
});

test("l'équipe génère un nouveau mot de passe, puis désactive l'accès", async ({
  page,
  browser,
}) => {
  const client = await clientBrowser(browser);
  await portalLogin(client.page, credentials.login, credentials.password);
  await expect(client.page).toHaveURL("/espace-client");

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(clientUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/changé par le client le/)).toBeVisible();
  await page.getByRole("button", { name: "Nouveau mot de passe" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Générer" }).click();
  const fresh = await readCredentials(page);
  expect(fresh.login).toBe(credentials.login);
  expect(fresh.password).not.toBe(credentials.password);
  await credentialsDialog(page).getByRole("button", { name: "Terminé" }).click();

  // Le client est déconnecté ; l'ancien mot de passe ne fonctionne plus.
  await client.page.goto("/espace-client/factures");
  await client.page.waitForLoadState("networkidle");
  await expect(client.page).toHaveURL(/\/espace-client\/connexion/);
  await portalLogin(client.page, credentials.login, credentials.password);
  await expect(formAlert(client.page)).toHaveText("Identifiant ou mot de passe incorrect.");
  await portalLogin(client.page, credentials.login, fresh.password);
  await expect(client.page).toHaveURL("/espace-client");

  await page.getByRole("button", { name: "Désactiver l'accès" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Désactiver" }).click();
  await expect(page.getByText("Désactivé", { exact: true })).toBeVisible();
  await client.page.goto("/espace-client");
  await client.page.waitForLoadState("networkidle");
  await expect(client.page).toHaveURL(/\/espace-client\/connexion/);
  await portalLogin(client.page, credentials.login, fresh.password);
  await expect(formAlert(client.page)).toHaveText(
    "Votre accès à l'espace client est désactivé. Contactez-nous.",
  );

  await page.getByRole("button", { name: "Réactiver l'accès" }).click();
  await expect(page.getByText("Actif", { exact: true })).toBeVisible();
  await portalLogin(client.page, credentials.login, fresh.password);
  await expect(client.page).toHaveURL("/espace-client");
  await client.context.close();

  // Journal : catégorie « Espace client ».
  await page.goto("/parametres/journal?type=espace-client");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText(`a désactivé l'accès à l'espace client de ${CLIENT.name}`),
  ).toBeVisible();
  await expect(
    page.getByText("a choisi un nouveau mot de passe pour son espace client"),
  ).toBeVisible();
});

test("client germanophone : espace client en allemand", async ({ page, browser }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients");
  await page.waitForLoadState("networkidle");
  await page.locator("table").getByRole("link", { name: OTHER.name }).click();
  await page.getByRole("button", { name: "Créer l'accès à l'espace client" }).click();
  const other = await readCredentials(page);
  await credentialsDialog(page).getByRole("button", { name: "Terminé" }).click();

  const client = await clientBrowser(browser);
  await client.page.goto("/espace-client/connexion?langue=de");
  await client.page.waitForLoadState("networkidle");
  await expect(client.page.getByText("Kundenportal")).toBeVisible();
  await client.page.getByLabel("Benutzername").fill(other.login);
  await client.page.getByLabel("Passwort", { exact: true }).fill(other.password);
  await client.page.getByRole("button", { name: "Anmelden" }).click();
  await expect(client.page).toHaveURL("/espace-client");
  await expect(client.page.getByRole("link", { name: "Offerten" })).toBeVisible();
  await expect(client.page.getByText("Zu bezahlen", { exact: true })).toBeVisible();
  await expect(client.page.getByText("Zurzeit ist nichts zu bezahlen. Vielen Dank!")).toBeVisible();
  await client.page.getByRole("link", { name: "Offerten" }).click();
  await expect(client.page.getByText("Wartet auf Ihre Antwort")).toBeVisible();
  // Ses propres devis seulement : pas ceux de l'autre client.
  await expect(client.page.getByText(sentQuoteNumber)).toHaveCount(0);
  await client.context.close();
});
