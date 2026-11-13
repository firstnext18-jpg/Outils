import { expect, test, type Browser, type Page } from "@playwright/test";
import { acceptInvitation, ADMIN, invite, login, logout } from "./fixtures";

// Discussions entre utilisateurs : canal général, discussions par client,
// messages non lus, lecture seule, notifications. S'exécute après clients.spec.ts.
test.describe.configure({ mode: "serial" });

const CLIENT = "Studio Horizon";
const PROSPECT = "Prospect Éphémère";
const MEMBER = {
  name: "Marc Dubois",
  email: "marc.discussions@e2e.test",
  password: "Marc-E2E-Password",
};
const READER = {
  name: "Rita Lecture",
  email: "rita.discussions@e2e.test",
  password: "Rita-E2E-Password",
};
let discussionUrl = "";

async function newCompany(page: Page, name: string) {
  await page.goto("/clients/nouveau");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(name);
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function session(browser: Browser, person: { email: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, person.email, person.password);
  return { context, page };
}

const sidebarBadge = (page: Page) =>
  page
    .getByRole("link", { name: "Discussions" })
    .locator("xpath=..")
    .locator("[data-sidebar=menu-badge]");

test("préparation : un membre, une personne en lecture seule, un client", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await invite(page, MEMBER, "Membre");
  await logout(page);
  await acceptInvitation(page, MEMBER);
  await logout(page);

  await login(page, ADMIN.email, ADMIN.password);
  await invite(page, READER, "Lecture seule");
  await logout(page);
  await acceptInvitation(page, READER);
  await logout(page);

  await login(page, ADMIN.email, ADMIN.password);
  await newCompany(page, CLIENT);
});

test("canal général : toujours présent, ouvert à tous", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.getByRole("link", { name: "Discussions" }).click();
  await expect(page.getByRole("heading", { name: "Discussions", level: 1 })).toBeVisible();
  const list = page.getByRole("list", { name: "Discussions" });
  await expect(list.getByRole("listitem").first()).toContainText("Général");
  await list.getByRole("link", { name: /Général/ }).click();
  await expect(page.getByText("Canal général, ouvert à tous les utilisateurs.")).toBeVisible();

  const message = page.getByLabel("Votre message");
  await message.fill("Bonjour à tous,\nréunion lundi à 9h ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const thread = page.getByRole("list", { name: "Messages" });
  await expect(thread).toContainText("Bonjour à tous,");
  await expect(thread).toContainText("réunion lundi à 9h ?");
  await expect(thread).toContainText(ADMIN.name);
  await expect(message).toHaveValue("");
});

test("nouvelle discussion depuis la fiche du client", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients");
  await page.locator("table").getByRole("link", { name: CLIENT }).click();
  await expect(page.getByText("Aucune discussion sur ce client.")).toBeVisible();
  await page.getByRole("link", { name: "Nouvelle discussion" }).click();

  await expect(page.getByRole("combobox", { name: "Client" })).toHaveText(CLIENT);
  await page.getByRole("button", { name: "Démarrer la discussion" }).click();
  await expect(page.getByText("Indiquez le sujet de la discussion")).toBeVisible();
  await page.getByLabel("Sujet").fill("Choix du thème");
  await page.getByLabel("Message").fill("Clair ou sombre ? Maquette : https://exemple.ch/maquette");
  await page.getByRole("button", { name: "Démarrer la discussion" }).click();

  await expect(page.getByRole("heading", { name: "Choix du thème" })).toBeVisible();
  await expect(page.getByRole("link", { name: "https://exemple.ch/maquette" })).toHaveAttribute(
    "href",
    "https://exemple.ch/maquette",
  );
  discussionUrl = new URL(page.url()).pathname;
  expect(discussionUrl).toMatch(/^\/discussions\/[0-9a-f-]{36}$/);

  await page.getByRole("link", { name: CLIENT }).click();
  await expect(
    page.getByRole("list", { name: "Discussions" }).getByRole("link", { name: /Choix du thème/ }),
  ).toBeVisible();
});

test("un autre utilisateur voit les messages non lus et répond ; le fil se met à jour seul", async ({
  page,
  browser,
}) => {
  // L'admin garde la discussion ouverte pendant que Marc répond.
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(discussionUrl);
  // Accusé de lecture sous son propre message : personne ne l'a encore lu.
  await expect(page.getByText("Pas encore lu")).toBeVisible();

  const marc = await session(browser, MEMBER);
  await expect(sidebarBadge(marc.page)).toHaveText("2");
  await marc.page.goto("/discussions");
  const list = marc.page.getByRole("list", { name: "Discussions" });
  const themed = list.getByRole("listitem").filter({ hasText: "Choix du thème" });
  await expect(themed).toContainText(CLIENT);
  await expect(themed).toContainText(`${ADMIN.name} : Clair ou sombre ?`);
  await expect(themed.getByLabel("1 message non lu")).toBeVisible();

  await themed.getByRole("link").click();
  await marc.page.getByLabel("Votre message").fill("Plutôt clair, plus lisible.");
  await marc.page.getByLabel("Votre message").press("Enter");
  await expect(marc.page.getByRole("list", { name: "Messages" })).toContainText(
    "Plutôt clair, plus lisible.",
  );
  // Discussion lue : il ne reste que le canal général non lu.
  await marc.page.goto("/discussions");
  await expect(sidebarBadge(marc.page)).toHaveText("1");
  await expect(themed.getByLabel(/non lu/)).toHaveCount(0);
  await marc.context.close();

  // Rafraîchissement automatique chez l'admin (toutes les 5 secondes).
  await expect(page.getByRole("list", { name: "Messages" })).toContainText(
    "Plutôt clair, plus lisible.",
    { timeout: 15_000 },
  );
  await expect(page.getByRole("list", { name: "Messages" })).toContainText(MEMBER.name);
  await expect(page.getByText(`Lu par ${MEMBER.name}`)).toBeVisible();
});

test("lecture seule : lit les discussions sans pouvoir écrire", async ({ page }) => {
  await login(page, READER.email, READER.password);
  await page.goto("/discussions");
  await expect(sidebarBadge(page)).toHaveText("2");
  await expect(page.getByRole("link", { name: "Nouvelle discussion" })).toHaveCount(0);
  await page.goto(discussionUrl);
  await expect(page.getByRole("list", { name: "Messages" })).toContainText("Plutôt clair");
  await expect(page.getByLabel("Votre message")).toHaveCount(0);
  await expect(page.getByText("Accès en lecture seule")).toBeVisible();
  // Les accusés de lecture ne sont montrés qu'à l'auteur des messages.
  await expect(page.getByText(/^(Lu par|Pas encore lu)/)).toHaveCount(0);
  // Lire suffit à marquer la discussion comme lue.
  await expect(async () => {
    await page.goto("/discussions");
    await expect(sidebarBadge(page)).toHaveText("1", { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await page.goto("/discussions/nouvelle");
  await expect(page).toHaveURL(/\/acces-refuse/);
});

test("journal, notifications et suppression d'un client avec ses discussions", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(discussionUrl);
  await expect(page.getByText(`Lu par ${MEMBER.name} et ${READER.name}`)).toBeVisible();
  await page.goto("/parametres/journal?type=discussions");
  await expect(
    page.getByText(`a démarré la discussion « Choix du thème » sur le client « ${CLIENT} »`),
  ).toBeVisible();

  // Notifications configurées (clés VAPID) : proposées dans le menu utilisateur.
  await page.getByRole("button", { name: "Menu utilisateur" }).click();
  await expect(page.getByRole("menuitem", { name: "Activer les notifications" })).toBeVisible();
  await page.keyboard.press("Escape");
  const sw = await page.request.get("/sw.js", { headers: { cookie: "" } });
  expect(sw.status()).toBe(200);
  expect(await sw.text()).toContain("showNotification");

  // Un prospect supprimé emporte ses discussions.
  await newCompany(page, PROSPECT);
  await page.getByRole("link", { name: "Nouvelle discussion" }).click();
  await page.getByLabel("Sujet").fill("Le relancer ?");
  await page.getByLabel("Message").fill("Pas de nouvelles depuis un mois.");
  await page.getByRole("button", { name: "Démarrer la discussion" }).click();
  await expect(page.getByRole("heading", { name: "Le relancer ?" })).toBeVisible();
  await page.getByRole("link", { name: PROSPECT }).click();
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await expect(
    page.getByText("La fiche, ses discussions et son accès à l'espace client"),
  ).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  await expect(page).toHaveURL(/\/clients$/);
  await page.goto("/discussions");
  await expect(page.getByRole("list", { name: "Discussions" })).not.toContainText("Le relancer ?");
});
