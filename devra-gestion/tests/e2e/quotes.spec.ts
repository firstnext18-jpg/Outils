import { expect, test, type Page } from "@playwright/test";
import { acceptInvitation, ADMIN, invite, login, logout } from "./fixtures";

// Parcours enchaînés sur les mêmes devis : création, statuts, modification,
// duplication, suppression, PDF, droits, puis paramètres de numérotation et TVA.
test.describe.configure({ mode: "serial" });

const YEAR = new Intl.DateTimeFormat("fr-CH", {
  year: "numeric",
  timeZone: "Europe/Zurich",
}).format(new Date());
const CLIENT = "Menuiserie Test SA";
const READER = {
  name: "Léa Lecture",
  email: "lea@e2e-quotes.test",
  password: "Lea-Password-2026",
};

let firstQuoteUrl = "";

function pdfUrl(query = "") {
  return `/api/devis/${firstQuoteUrl.split("/").pop()}/pdf${query}`;
}

/** Montant affiché dans le récapitulatif (« Montants »). */
function amount(page: Page, label: string | RegExp) {
  return page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: label }) })
    .locator("dd");
}

async function pickClient(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByPlaceholder("Rechercher un client…").fill(name.split(" ")[0]!);
  await page.getByRole("option", { name }).click();
}

async function addFromCatalog(page: Page, names: string[]) {
  await page.getByRole("button", { name: "Ajouter depuis le catalogue" }).click();
  const dialog = page.getByRole("dialog");
  for (const name of names) {
    await dialog
      .getByRole("option")
      .filter({ has: page.getByText(name, { exact: true }) })
      .click();
  }
  await expect(dialog.getByRole("status")).toHaveText(
    `${names.length} ligne${names.length > 1 ? "s" : ""} ajoutée${names.length > 1 ? "s" : ""}`,
  );
  await dialog.getByRole("button", { name: "Terminé" }).click();
}

async function otherAction(page: Page, name: string) {
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name }).click();
}

test("création d'un devis : catalogue, ligne libre, remises, arrondi et acompte", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);

  // Client du devis.
  await page.goto("/clients/nouveau");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(CLIENT);
  await page.getByLabel("Rue").fill("Chemin des Planches");
  await page.getByLabel("Numéro").fill("4");
  await page.getByLabel("NPA").fill("1003");
  await page.getByLabel("Localité").fill("Lausanne");
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name: CLIENT })).toBeVisible();

  await page.goto("/devis/nouveau");
  await page.getByRole("button", { name: "Créer le devis" }).first().click();
  await expect(page.getByText("Choisissez un client")).toBeVisible();
  await expect(page.getByText("Ajoutez au moins une ligne")).toBeVisible();

  await pickClient(page, CLIENT);
  await page.getByLabel("Objet (facultatif)").fill("Nouveau site de l'atelier");
  await addFromCatalog(page, ["Site vitrine (jusqu'à 5 pages)", "Hébergement + maintenance"]);
  await expect(page.getByLabel("Désignation de la ligne 1")).toHaveValue(
    "Site vitrine (jusqu'à 5 pages)",
  );
  await expect(page.getByLabel("Total de la ligne 2")).toHaveText("CHF 29.00");

  // Remise de 10 % sur la première ligne.
  await page.getByLabel("Remise de la ligne 1", { exact: true }).fill("10");
  await expect(page.getByLabel("Total de la ligne 1")).toHaveText("CHF 1'341.00");

  // Ligne libre : 2,5 × 80.33 = 200.825 → 200.83.
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 3").fill("Séance photo");
  await page.getByLabel("Quantité de la ligne 3").fill("2,5");
  await page.getByLabel("Prix unitaire de la ligne 3").fill("80.33");
  await expect(page.getByLabel("Total de la ligne 3")).toHaveText("CHF 200.83");

  // Remise globale 5 % et acompte 30 % : calculés sur le montant unique seulement.
  await page.getByLabel("Remise globale", { exact: true }).fill("5");
  await page.getByLabel("Acompte à la commande", { exact: true }).fill("30");
  await expect(amount(page, "Sous-total")).toHaveText("CHF 1'541.83");
  await expect(amount(page, "Remise (5 %)")).toHaveText("CHF -77.09");
  await expect(amount(page, "Arrondi")).toHaveText("CHF 0.01");
  await expect(amount(page, /^Total$/)).toHaveText("CHF 1'464.75");
  await expect(amount(page, "Par mois")).toHaveText("CHF 29.00");
  await expect(amount(page, "Acompte à la commande")).toHaveText("CHF 439.45");

  await page.getByRole("button", { name: "Créer le devis" }).first().click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  firstQuoteUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: `Devis D-${YEAR}-001` })).toBeVisible();
  await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
  // Les montants enregistrés sont ceux calculés pendant la saisie.
  await expect(amount(page, /^Total$/)).toHaveText("CHF 1'464.75");
  await expect(amount(page, "Acompte à la commande (30 %)")).toHaveText("CHF 439.45");
  await expect(page.getByRole("cell", { name: "Séance photo" })).toBeVisible();
});

test("statuts : envoyé, accepté, annulation, retour en brouillon", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(firstQuoteUrl);

  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  await expect(page.getByText(`Devis D-${YEAR}-001 : envoyé.`)).toBeVisible();
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();
  // Un devis envoyé n'est plus modifiable…
  await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  await page.goto(`${firstQuoteUrl}/modifier`);
  await expect(page).toHaveURL(firstQuoteUrl);

  await page.getByRole("button", { name: "Marquer comme accepté" }).click();
  await expect(page.getByText("Accepté", { exact: true })).toBeVisible();
  await otherAction(page, "Annuler l'acceptation");
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();

  // …sauf en le repassant en brouillon.
  await otherAction(page, "Repasser en brouillon");
  await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier" })).toBeVisible();
  await expect(page.getByText("a repassé le devis en brouillon")).toBeVisible();
});

test("modification d'un brouillon", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(firstQuoteUrl);
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(page.getByLabel("Remise globale", { exact: true })).toHaveValue("5");

  await page.getByRole("button", { name: "Supprimer la ligne 3" }).click();
  await page.getByLabel("Remise globale", { exact: true }).fill("");
  await page.getByLabel("Acompte à la commande", { exact: true }).fill("");
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await expect(page.getByText(`Devis D-${YEAR}-001 enregistré.`)).toBeVisible();
  await expect(page).toHaveURL(firstQuoteUrl);
  await expect(amount(page, /^Total$/)).toHaveText("CHF 1'341.00");
  await expect(page.getByRole("cell", { name: "Séance photo" })).toHaveCount(0);
});

test("duplication puis suppression du brouillon ; le numéro n'est pas réattribué", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(firstQuoteUrl);
  await otherAction(page, "Dupliquer");
  await expect(page.getByText(`Copie créée : D-${YEAR}-002.`)).toBeVisible();
  await expect(page.getByRole("heading", { name: `Devis D-${YEAR}-002` })).toBeVisible();
  await expect(amount(page, /^Total$/)).toHaveText("CHF 1'341.00");

  await otherAction(page, "Supprimer");
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page).toHaveURL("/devis");
  await expect(page.getByText(`Devis D-${YEAR}-002 supprimé.`)).toBeVisible();
  await expect(page.getByRole("link", { name: `D-${YEAR}-002` })).toHaveCount(0);

  await page.goto(firstQuoteUrl);
  await otherAction(page, "Dupliquer");
  await expect(page.getByRole("heading", { name: `Devis D-${YEAR}-003` })).toBeVisible();
});

test("liste : recherche et filtre par statut", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(firstQuoteUrl);
  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();

  await page.goto("/devis");
  await expect(page.getByRole("link", { name: `D-${YEAR}-001` })).toBeVisible();
  await expect(page.getByRole("link", { name: `D-${YEAR}-003` })).toBeVisible();

  await page.getByLabel("Rechercher un devis").fill("menuiserie atelier");
  await expect(page).toHaveURL(/q=menuiserie/);
  await expect(page.getByRole("link", { name: `D-${YEAR}-001` })).toBeVisible();

  await page.goto("/devis?statut=brouillon");
  await expect(page.getByRole("link", { name: `D-${YEAR}-003` })).toBeVisible();
  await expect(page.getByRole("link", { name: `D-${YEAR}-001` })).toHaveCount(0);

  // Recherche globale par numéro.
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Client, numéro de devis ou de facture…").fill(`D-${YEAR}-001`);
  await page.getByRole("option", { name: new RegExp(`D-${YEAR}-001`) }).click();
  await expect(page).toHaveURL(firstQuoteUrl);
});

test("PDF du devis, en français puis en allemand", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(firstQuoteUrl);

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "PDF", exact: true }).click();
  // Nom de l'entreprise pas encore renseigné : le fichier commence par le type de document.
  expect((await download).suggestedFilename()).toBe(`Devis_D-${YEAR}-001_MenuiserieTestSA.pdf`);

  const inline = await page.request.get(pdfUrl());
  expect(inline.status()).toBe(200);
  expect(inline.headers()["content-type"]).toBe("application/pdf");
  expect(inline.headers()["content-disposition"]).toMatch(/^inline;/);
  expect((await inline.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // En allemand, le document s'intitule « Offerte ».
  await otherAction(page, "Repasser en brouillon");
  await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("combobox", { name: "Langue du document" }).click();
  await page.getByRole("option", { name: "Allemand" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await expect(page).toHaveURL(firstQuoteUrl);
  await expect(page.locator("dd", { hasText: "Allemand" })).toBeVisible();
  const german = await page.request.get(pdfUrl("?telecharger=1"));
  expect(german.headers()["content-disposition"]).toBe(
    `attachment; filename="Offerte_D-${YEAR}-001_MenuiserieTestSA.pdf"`,
  );

  // Sans connexion, le PDF n'est pas accessible.
  await logout(page);
  const anonymous = await page.request.get(pdfUrl());
  expect(anonymous.status()).toBe(401);
});

test("un client qui a des devis ne peut pas être supprimé", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients");
  await page.locator("table").getByRole("link", { name: CLIENT }).click();
  await expect(page.getByRole("link", { name: `D-${YEAR}-001` })).toBeVisible();

  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  await expect(page.getByText("Ce client a 2 devis : il ne peut pas être supprimé.")).toBeVisible();

  // « Nouveau devis » depuis la fiche : le client est déjà choisi.
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Nouveau devis" }).click();
  await expect(page.getByRole("combobox", { name: "Client" })).toHaveText(CLIENT);
});

test("lecture seule : consulte les devis sans pouvoir les modifier", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await invite(page, READER, "Lecture seule");
  await logout(page);
  await acceptInvitation(page, READER);

  await page.goto("/devis");
  await expect(page.getByRole("link", { name: "Nouveau devis" })).toHaveCount(0);
  await page.getByRole("link", { name: `D-${YEAR}-001` }).click();
  await expect(page.getByRole("link", { name: "Aperçu PDF" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Autres actions" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Marquer comme envoyé" })).toHaveCount(0);
});

test("paramètres : format de numéro, prochain numéro, textes et TVA", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/facturation");
  await expect(page.getByText(`Dernier numéro ${YEAR} : D-${YEAR}-003.`)).toBeVisible();

  await page.getByLabel("Format des devis").fill("OF-{NNN}");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Le format doit contenir l'année")).toBeVisible();

  await page.getByLabel("Format des devis").fill("OF-{AA}-{NNNN}");
  await page.getByLabel(`Prochain numéro ${YEAR} (facultatif)`).first().fill("2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("doit être supérieur à 3")).toBeVisible();

  await page.getByLabel(`Prochain numéro ${YEAR} (facultatif)`).first().fill("50");
  await page.getByLabel("Entreprise assujettie à la TVA").click();
  await page.getByLabel("Numéro TVA").fill("CHE-123.456.789 TVA");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres de facturation enregistrés.")).toBeVisible();

  await page.goto("/parametres/documents");
  await page.getByLabel("Introduction des devis — Français").fill("Merci pour votre confiance.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Textes des documents enregistrés.")).toBeVisible();

  // Nouveau devis : nouveau format, texte par défaut et TVA à 8.1 %.
  await page.goto("/devis/nouveau");
  await expect(page.getByLabel("Introduction")).toHaveValue("Merci pour votre confiance.");
  await pickClient(page, CLIENT);
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 1").fill("Audit du site");
  await page.getByLabel("Prix unitaire de la ligne 1").fill("1000");
  await expect(page.getByRole("combobox", { name: "TVA de la ligne 1" })).toHaveText("TVA 8.1 %");
  await expect(amount(page, "TVA 8.1 %")).toHaveText("CHF 81.00");
  await expect(amount(page, /^Total$/)).toHaveText("CHF 1'081.00");
  await page.getByRole("button", { name: "Créer le devis" }).first().click();
  const shortYear = YEAR.slice(2);
  await expect(page.getByRole("heading", { name: `Devis OF-${shortYear}-0050` })).toBeVisible();
  await expect(amount(page, /^Total$/)).toHaveText("CHF 1'081.00");
});
