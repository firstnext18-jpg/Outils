import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { acceptInvitation, ADMIN, formAlert, invite, login, logout } from "./fixtures";

// Parcours enchaînés : la liste est vide au départ, puis on crée, modifie,
// importe, exporte, archive et supprime des clients.
test.describe.configure({ mode: "serial" });

const READER = {
  name: "Rita Lecture",
  email: "rita@e2e-clients.test",
  password: "Rita-Password-2026",
};

async function openNewClientForm(page: Page) {
  await page.goto("/clients/nouveau");
  await expect(page.getByRole("heading", { name: "Nouveau client" })).toBeVisible();
}

async function chooseOption(page: Page, label: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}

test("liste vide : invitation à ajouter ou importer des clients", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients");
  await expect(page.getByText("Aucun client pour l'instant")).toBeVisible();
  await expect(page.getByRole("link", { name: "Importer un fichier" })).toBeVisible();
});

test("création d'un particulier : validation puis fiche", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await openNewClientForm(page);

  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByText("Le nom est obligatoire")).toBeVisible();

  await page.getByLabel("Prénom").fill("Zoé");
  await page.getByLabel("Nom", { exact: true }).fill("Keller");
  await page.getByLabel("Rue").fill("Bahnhofstrasse");
  await page.getByLabel("Numéro").fill("10");
  await page.getByLabel("NPA").fill("800");
  await page.getByLabel("Localité").fill("Zürich");
  await chooseOption(page, "Canton", "Zurich (ZH)");
  await page.getByLabel("Email").fill("Zoe.Keller@E2E-Clients.test");
  await chooseOption(page, "Langue des documents", "Allemand");
  await page.getByLabel("Tags").fill("vip");
  await page.getByLabel("Tags").press("Enter");
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByText("NPA suisse : 4 chiffres")).toBeVisible();

  await page.getByLabel("NPA").fill("8001");
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Zoé Keller" })).toBeVisible();
  await expect(page.getByText("8001 Zürich")).toBeVisible();
  await expect(page.getByText("Canton de Zurich")).toBeVisible();
  await expect(page.getByText("zoe.keller@e2e-clients.test")).toBeVisible();
  await expect(page.getByText("Allemand")).toBeVisible();
  await expect(page.getByText("a créé la fiche")).toBeVisible();
});

test("création d'une entreprise", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await openNewClientForm(page);
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill("Menuiserie Dubois Sàrl");
  await page.getByLabel("Personne de contact").fill("Jean Dubois");
  await page.getByLabel("NPA").fill("1950");
  await page.getByLabel("Localité").fill("Sion");
  await chooseOption(page, "Canton", "Valais (VS)");
  await page.getByLabel("Email").fill("contact@dubois.e2e-clients.test");
  await chooseOption(page, "Type de site demandé", "Vitrine");
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name: "Menuiserie Dubois Sàrl" })).toBeVisible();
  await expect(page.getByText("Jean Dubois")).toBeVisible();
});

test("recherche sans accents, filtres et tri", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients");
  await expect(page.getByText("2 clients")).toBeVisible();

  await page.getByLabel("Rechercher un client").fill("zurich");
  await expect(page).toHaveURL(/q=zurich/);
  const table = page.locator("table");
  await expect(table.getByRole("link", { name: "Zoé Keller" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Menuiserie Dubois Sàrl" })).toHaveCount(0);

  await page.getByRole("button", { name: "Effacer les filtres" }).click();
  await chooseOption(page, "Type", "Entreprises");
  await expect(table.getByRole("link", { name: "Menuiserie Dubois Sàrl" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Zoé Keller" })).toHaveCount(0);

  await page.getByRole("button", { name: "Effacer les filtres" }).click();
  await chooseOption(page, "Canton", "Valais");
  await expect(table.getByRole("link")).toHaveText(["Menuiserie Dubois Sàrl"]);

  await page.goto("/clients?tri=-nom");
  await expect(table.getByRole("link")).toHaveText(["Zoé Keller", "Menuiserie Dubois Sàrl"]);
});

test("modification, historique et conflit entre deux utilisateurs", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients");
  await page.getByRole("link", { name: "Zoé Keller" }).first().click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}$/);
  const clientUrl = page.url();

  // Deux onglets ouvrent la même fiche en modification.
  await page.goto(`${clientUrl}/modifier`);
  const other = await page.context().newPage();
  await other.goto(`${clientUrl}/modifier`);

  await page.getByLabel("Téléphone").fill("044 555 12 34");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(clientUrl);
  await expect(page.getByText("a modifié : téléphone")).toBeVisible();

  await other.getByLabel("Localité").fill("Winterthur");
  await other.getByRole("button", { name: "Enregistrer" }).click();
  await expect(formAlert(other)).toContainText("modifiée par quelqu'un d'autre");
  await other.close();

  await page.reload();
  await expect(page.getByText("8001 Zürich")).toBeVisible();
  await expect(page.getByText("044 555 12 34")).toBeVisible();
});

test("import CSV : correspondance automatique, doublons et erreurs", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients/import");

  // Fichier « à la Excel » : points-virgules et encodage Windows-1252.
  const csv = [
    "Nom;Prénom;Entreprise;Adresse;NPA;Ville;Canton;E-mail;Type de site",
    "Rochat;Nadia;;Rue du Lac 12;1820;Montreux;Vaud;nadia@e2e-import.test;Vitrine",
    ";;Garage Central SA;Route de Berne 3;1700;Fribourg;FR;garage@e2e-import.test;E-commerce",
    ";Sans nom;;;;;;;",
    "Keller;Zoé;;;;;;zoe.keller@e2e-clients.test;",
    "Rochat;Nadia bis;;;;;;nadia@e2e-import.test;",
  ].join("\r\n");
  await page.getByLabel("Fichier à importer").setInputFiles({
    name: "clients.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "latin1"),
  });

  await expect(page.getByText("clients.csv · 5 lignes")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Colonne pour Raison sociale" })).toHaveText(
    "Entreprise",
  );
  await expect(page.getByRole("combobox", { name: "Colonne pour Localité" })).toHaveText("Ville");
  await page.getByRole("button", { name: "Vérifier les données" }).click();

  await expect(page.getByText("prêtes à importer")).toBeVisible();
  await expect(page.getByText("Nom : Le nom est obligatoire")).toBeVisible();
  await page.getByRole("button", { name: /^Doublons/ }).click();
  await expect(page.getByText("Un client avec cet email existe déjà.")).toBeVisible();
  await expect(page.getByText("Même email qu'une ligne précédente du fichier.")).toBeVisible();

  await page.getByRole("button", { name: "Importer 2 clients" }).click();
  await expect(page.getByText("2 clients importés")).toBeVisible();
  await expect(
    page.getByText("2 doublon(s) ignoré(s) · 1 ligne(s) en erreur ignorée(s)"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Voir les clients" }).click();
  await expect(page.getByText("4 clients")).toBeVisible();
  await page.locator("table").getByRole("link", { name: "Nadia Rochat" }).click();
  // L'adresse saisie en une colonne a été séparée en rue + numéro.
  await expect(page.getByText("Rue du Lac 12")).toBeVisible();
  await expect(page.getByText("Canton de Vaud")).toBeVisible();
});

test("export CSV de la liste filtrée", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients?type=entreprise");
  await page.getByRole("button", { name: "Exporter" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "CSV (.csv)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Clients_\d{4}-\d{2}-\d{2}\.csv$/);
  const content = await readFile(await download.path(), "utf8");
  expect(content.startsWith("﻿Type;Nom affiché;")).toBe(true);
  expect(content).toContain("Garage Central SA");
  expect(content).toContain("Menuiserie Dubois Sàrl");
  expect(content).not.toContain("Zoé Keller"); // particulier : exclu par le filtre
});

test("recherche globale (Ctrl+K)", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Client, numéro de devis ou de facture…").fill("montreux");
  await page.getByRole("option", { name: /Nadia Rochat/ }).click();
  await expect(page.getByRole("heading", { name: "Nadia Rochat" })).toBeVisible();
});

test("export des données d'un client (nLPD)", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients?q=nadia");
  await page.locator("table").getByRole("link", { name: "Nadia Rochat" }).click();
  await page.getByRole("button", { name: "Autres actions" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "Exporter ses données (nLPD)" }).click(),
  ]);
  const data = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(data.client).toMatchObject({
    displayName: "Nadia Rochat",
    city: "Montreux",
    canton: "VD",
  });
  expect(data.exportedBy).toBe(ADMIN.name);
});

test("archivage, puis suppression", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients");
  await page.locator("table").getByRole("link", { name: "Garage Central SA" }).click();

  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name: "Archiver" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archiver" }).click();
  await expect(page.getByText("Client archivé.")).toBeVisible();
  await expect(page.getByText(/Archivé le/)).toBeVisible();

  await page.goto("/clients");
  await expect(page.locator("table").getByRole("link", { name: "Garage Central SA" })).toHaveCount(
    0,
  );
  await chooseOption(page, "Statut", "Archivés");
  await page.locator("table").getByRole("link", { name: "Garage Central SA" }).click();

  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  await expect(page).toHaveURL("/clients");
  await expect(page.getByText("Garage Central SA a été supprimé.")).toBeVisible();
});

test("types de sites : ajout, puis désactivation", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/types-de-sites");
  await page.getByLabel("Nom du nouveau type de site").fill("Application web");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("« Application web » ajouté.")).toBeVisible();

  await page.getByLabel("Nom du nouveau type de site").fill("application WEB");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Le type « Application web » existe déjà.")).toBeVisible();

  await openNewClientForm(page);
  await page.getByRole("combobox", { name: "Type de site demandé" }).click();
  await expect(page.getByRole("option", { name: "Application web" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/parametres/types-de-sites");
  await page.getByRole("switch", { name: "Application web proposé sur les fiches" }).click();
  await expect(page.getByText("Désactivé", { exact: true })).toBeVisible();
  await openNewClientForm(page);
  await page.getByRole("combobox", { name: "Type de site demandé" }).click();
  await expect(page.getByRole("option", { name: "Application web" })).toHaveCount(0);
});

test("lecture seule : consulte, mais ne modifie rien", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await invite(page, READER, "Lecture seule");
  await logout(page);
  await acceptInvitation(page, READER);

  await page.goto("/clients");
  await expect(page.locator("table").getByRole("link", { name: "Nadia Rochat" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nouveau client" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Importer" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exporter" })).toBeVisible();

  await page.locator("table").getByRole("link", { name: "Nadia Rochat" }).click();
  await expect(page.getByRole("heading", { name: "Nadia Rochat" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Autres actions" })).toHaveCount(0);

  for (const path of [
    "/clients/nouveau",
    "/clients/import",
    `${new URL(page.url()).pathname}/modifier`,
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL("/acces-refuse");
  }
});
