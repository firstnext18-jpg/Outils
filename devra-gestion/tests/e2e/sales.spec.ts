import { expect, test, type Page } from "@playwright/test";
import {
  acceptInvitation,
  ADMIN,
  deleteEmailsTo,
  invite,
  login,
  logout,
  setSmtpFailure,
  waitForEmail,
} from "./fixtures";

// Cycle de vente complet : devis envoyé par email → acceptation → facture
// (QR-facture) envoyée par email → paiements, puis acompte et facture finale,
// retard, annulation, modèles d'emails et droits.
// S'exécute après quotes.spec.ts (ordre alphabétique) : les numéros de devis
// ne sont donc pas vérifiés ici, seulement ceux des factures.
test.describe.configure({ mode: "serial" });

const YEAR = new Intl.DateTimeFormat("fr-CH", {
  year: "numeric",
  timeZone: "Europe/Zurich",
}).format(new Date());
const F = (n: number) => `F-${YEAR}-${String(n).padStart(3, "0")}`;
const CLIENT = "Atelier Vélo SA";
const CLIENT_EMAIL = "compta@atelier-velo.test";
const COMPANY_EMAIL = "contact@devra-test.example";
const READER = { name: "Lou Lecture", email: "lou@e2e-sales.test", password: "Lou-Password-2026" };

let firstInvoiceUrl = "";

/** Date (AAAA-MM-JJ) d'il y a `days` jours, selon le calendrier de Zurich. */
function zurichDaysAgo(days: number) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function amount(page: Page, label: string | RegExp) {
  return page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: label }) })
    .locator("dd");
}

/** Fiche « Informations » : valeur d'une ligne. */
function info(page: Page, label: string) {
  return page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
}

async function pickClient(page: Page) {
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByPlaceholder("Rechercher un client…").fill("atelier velo");
  await page.getByRole("option", { name: CLIENT }).click();
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
  await dialog.getByRole("button", { name: "Terminé" }).click();
}

async function otherAction(page: Page, name: string) {
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name }).click();
}

/** Crée un devis (brouillon) et renvoie son numéro. */
async function newQuote(page: Page, fill: () => Promise<void>) {
  await page.goto("/devis/nouveau");
  await pickClient(page);
  await fill();
  await page.getByRole("button", { name: "Créer le devis" }).first().click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  const heading = await page.getByRole("heading", { level: 1 }).textContent();
  return heading!.replace("Devis ", "").trim();
}

/** Crée un devis (déjà accepté) et renvoie l'adresse de sa page. */
async function acceptedQuote(page: Page, fill: () => Promise<void>) {
  await newQuote(page, fill);
  await otherAction(page, "Marquer comme envoyé");
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Marquer comme accepté" }).click();
  await expect(page.getByText("Accepté", { exact: true })).toBeVisible();
  return new URL(page.url()).pathname;
}

async function issue(page: Page, number: string) {
  await otherAction(page, "Émettre sans envoyer");
  await page.getByRole("alertdialog").getByRole("button", { name: "Émettre" }).click();
  await expect(page.getByText(`Facture ${number} émise.`)).toBeVisible();
}

test("préparation : coordonnées de l'entreprise, IBAN et TVA désactivée", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/entreprise");
  await page.getByLabel("Nom de l'entreprise").fill("Devra Test");
  await page.getByLabel("Rue").fill("Rue du Lac");
  await page.getByLabel("Numéro").fill("12");
  await page.getByLabel("NPA").fill("1003");
  await page.getByLabel("Localité").fill("Lausanne");
  await page.getByLabel("Email").fill(COMPANY_EMAIL);
  await page.getByLabel("IBAN", { exact: true }).fill("CH93 0076 2011 6238 5295 7");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de l'entreprise enregistrées.")).toBeVisible();

  // Le test des devis a activé la TVA : on revient au réglage par défaut.
  await page.goto("/parametres/facturation");
  const vat = page.getByLabel("Entreprise assujettie à la TVA");
  if (await vat.isChecked()) await vat.click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres de facturation enregistrés.")).toBeVisible();

  await page.goto("/clients/nouveau");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(CLIENT);
  await page.getByLabel("Rue").fill("Rue du Port");
  await page.getByLabel("Numéro").fill("3");
  await page.getByLabel("NPA").fill("2000");
  await page.getByLabel("Localité").fill("Neuchâtel");
  await page.getByLabel("Email").fill(CLIENT_EMAIL);
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name: CLIENT })).toBeVisible();
});

test("parcours complet : devis envoyé par email → facture envoyée → paiements", async ({
  page,
}) => {
  await deleteEmailsTo(CLIENT_EMAIL);
  await login(page, ADMIN.email, ADMIN.password);
  const quoteNumber = await newQuote(page, () =>
    addFromCatalog(page, ["Site vitrine (jusqu'à 5 pages)", "Hébergement + maintenance"]),
  );
  const quoteUrl = new URL(page.url()).pathname;

  // Envoi du devis par email : modèle rempli, PDF joint, copie à l'expéditeur.
  await page.getByRole("button", { name: "Envoyer par email" }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Destinataires")).toHaveValue(CLIENT_EMAIL);
  await expect(dialog.getByLabel("Objet")).toHaveValue(`Devis ${quoteNumber}`);
  await expect(dialog.getByLabel("Message")).toHaveValue(/d'un montant de CHF 1'490\.00/);
  await expect(dialog.getByText(`DevraTest_Devis_${quoteNumber}_AtelierVeloSA.pdf`)).toBeVisible();
  await dialog.getByLabel(/M'envoyer une copie/).check();
  await dialog.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText(`Devis ${quoteNumber} envoyé à ${CLIENT_EMAIL}.`)).toBeVisible();
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();
  await expect(page.getByText(`À ${CLIENT_EMAIL}`, { exact: true })).toBeVisible();

  const quoteEmail = await waitForEmail(`to:"${CLIENT_EMAIL}"`, `Devis ${quoteNumber}`);
  expect(quoteEmail.Attachments.map((a) => [a.FileName, a.ContentType])).toEqual([
    [`DevraTest_Devis_${quoteNumber}_AtelierVeloSA.pdf`, "application/pdf"],
  ]);
  expect(quoteEmail.Text).toContain("Devra Test");
  expect(quoteEmail.ReplyTo.map((r) => r.Address)).toEqual([COMPANY_EMAIL]);
  expect(quoteEmail.Bcc.map((r) => r.Address)).toEqual([ADMIN.email]);

  await page.getByRole("button", { name: "Marquer comme accepté" }).click();
  await expect(page.getByText("Accepté", { exact: true })).toBeVisible();

  // Conversion en un clic : l'abonnement n'est pas repris dans la facture.
  await expect(page.getByText(/Les abonnements \(CHF 29\.00 \/ mois\)/)).toBeVisible();
  await page.getByRole("button", { name: "Créer la facture" }).click();
  await expect(page).toHaveURL(/\/factures\/[0-9a-f-]{36}$/);
  firstInvoiceUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: "Facture (brouillon)" })).toBeVisible();
  await expect(page.getByText("Site vitrine (jusqu'à 5 pages)")).toBeVisible();
  await expect(page.getByText("Hébergement + maintenance")).toHaveCount(0);
  await expect(amount(page, /^Total$/)).toHaveText("CHF 1'490.00");

  // « Émettre et envoyer » : la facture reçoit son numéro, puis part par email.
  await page.getByRole("button", { name: "Émettre et envoyer" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText("La facture sera d'abord émise")).toBeVisible();
  await expect(dialog.getByLabel("Objet")).toHaveValue("Facture {numero}");
  await dialog.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText(`Facture ${F(1)} envoyée à ${CLIENT_EMAIL}.`)).toBeVisible();
  const invoiceEmail = await waitForEmail(`to:"${CLIENT_EMAIL}"`, `Facture ${F(1)}`);
  expect(invoiceEmail.Attachments.map((a) => a.FileName)).toEqual([
    `DevraTest_Facture_${F(1)}_AtelierVeloSA.pdf`,
  ]);
  expect(invoiceEmail.Text).toContain(`notre facture ${F(1)} d'un montant de CHF 1'490.00`);

  // Émise : numéro sans trou, référence SCOR (IBAN classique), facture verrouillée.
  await expect(page.getByRole("heading", { name: `Facture ${F(1)}` })).toBeVisible();
  await expect(page.getByText("Envoyée", { exact: true })).toBeVisible();
  await expect(info(page, "Référence")).toHaveText(/^RF\d{2} F\d{3}/);
  await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  await page.goto(`${firstInvoiceUrl}/modifier`);
  await expect(page).toHaveURL(firstInvoiceUrl);

  // PDF : nom de fichier propre.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "PDF", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(`DevraTest_Facture_${F(1)}_AtelierVeloSA.pdf`);

  // Un montant supérieur au solde est refusé.
  await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Montant")).toHaveValue("1'490.00");
  await dialog.getByLabel("Montant").fill("2000");
  await dialog.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await expect(dialog.locator('[data-slot="alert"]')).toContainText(
    "Le montant dépasse le solde de la facture (CHF 1'490.00).",
  );

  // Paiement partiel, puis solde par TWINT.
  await dialog.getByLabel("Montant").fill("500");
  await dialog.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await expect(
    page.getByText("Paiement de CHF 500.00 enregistré. Solde : CHF 990.00."),
  ).toBeVisible();
  await expect(page.getByText("Partiellement payée", { exact: true })).toBeVisible();
  await expect(amount(page, "Solde")).toHaveText("CHF 990.00");

  await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Montant")).toHaveValue("990.00");
  await dialog.getByRole("combobox", { name: "Moyen de paiement" }).click();
  await page.getByRole("option", { name: "TWINT" }).click();
  await dialog.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await expect(
    page.getByText(`Paiement de CHF 990.00 enregistré : la facture ${F(1)} est payée.`),
  ).toBeVisible();
  await expect(page.getByText("Payée", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer un paiement" })).toHaveCount(0);
  await expect(page.getByText("a enregistré un paiement de CHF 990.00 (TWINT)")).toBeVisible();

  // Le devis affiche sa facture et ne peut plus être refacturé.
  await page.goto(quoteUrl);
  await expect(page.getByRole("link", { name: new RegExp(F(1)) })).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer la facture" })).toHaveCount(0);
});

test("devis avec acompte : facture d'acompte, puis facture finale qui le déduit", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  const quoteUrl = await acceptedQuote(page, async () => {
    await page.getByRole("button", { name: "Ligne libre" }).click();
    await page.getByLabel("Désignation de la ligne 1").fill("Boutique en ligne");
    await page.getByLabel("Prix unitaire de la ligne 1").fill("4000");
    await page.getByLabel("Acompte à la commande", { exact: true }).fill("30");
  });

  await page.getByRole("button", { name: "Créer la facture d'acompte" }).click();
  await expect(page.getByRole("heading", { name: "Facture d'acompte (brouillon)" })).toBeVisible();
  await expect(page.getByText(/^Acompte de 30\s%\ssur le devis /)).toBeVisible();
  await expect(amount(page, /^Total$/)).toHaveText("CHF 1'200.00");
  await issue(page, F(2));

  await page.goto(quoteUrl);
  await page.getByRole("button", { name: "Créer la facture finale" }).click();
  await expect(page.getByRole("heading", { name: "Facture finale (brouillon)" })).toBeVisible();
  await expect(amount(page, /^Total$/)).toHaveText("CHF 4'000.00");
  await expect(amount(page, `Acompte facturé (${F(2)})`)).toHaveText("CHF -1'200.00");
  await expect(amount(page, "Montant à payer")).toHaveText("CHF 2'800.00");
  await expect(page.getByText("Acompte pas encore entièrement payé")).toBeVisible();
  await issue(page, F(3));
  await expect(page.getByRole("heading", { name: `Facture finale ${F(3)}` })).toBeVisible();
  await expect(amount(page, "Solde")).toHaveText("CHF 2'800.00");
});

test("facture directe en retard, puis annulée ; brouillon supprimé sans trou", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/factures/nouvelle");
  await pickClient(page);
  const past = zurichDaysAgo(60);
  await page.getByLabel("Date de la facture").fill(past);
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 1").fill("Maintenance ponctuelle");
  await page.getByLabel("Prix unitaire de la ligne 1").fill("180");
  await page.getByRole("button", { name: "Créer le brouillon" }).first().click();
  await expect(page.getByText("Brouillon de facture enregistré.")).toBeVisible();
  await issue(page, F(4));
  await expect(page.getByText("En retard", { exact: true })).toBeVisible();
  await expect(page.getByText("En retard de 45 jours")).toBeVisible();
  const overdueUrl = new URL(page.url()).pathname;

  await page.goto("/factures?statut=en-retard");
  await expect(page.getByRole("link", { name: F(4) })).toBeVisible();
  await expect(page.getByRole("link", { name: F(1) })).toHaveCount(0);

  await page.goto(overdueUrl);
  await otherAction(page, "Annuler la facture");
  const cancel = page.getByRole("alertdialog");
  await cancel.getByLabel("Motif de l'annulation").fill("Prestation offerte au client");
  await cancel.getByRole("button", { name: "Annuler la facture" }).click();
  await expect(page.getByText(`Facture ${F(4)} annulée.`)).toBeVisible();
  await expect(page.getByText("Motif : Prestation offerte au client")).toBeVisible();
  await expect(page.getByText("Annulée", { exact: true })).toBeVisible();

  // Un brouillon supprimé ne consomme pas de numéro.
  await page.goto("/factures/nouvelle");
  await pickClient(page);
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 1").fill("Brouillon à supprimer");
  await page.getByLabel("Prix unitaire de la ligne 1").fill("10");
  await page.getByRole("button", { name: "Créer le brouillon" }).first().click();
  await expect(page.getByRole("heading", { name: "Facture (brouillon)" })).toBeVisible();
  await otherAction(page, "Supprimer");
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page).toHaveURL("/factures");
  await expect(page.getByText("Brouillon de facture supprimé.")).toBeVisible();

  await page.goto("/parametres/facturation");
  await expect(page.getByText(`Dernier numéro ${YEAR} : ${F(4)}.`)).toBeVisible();
});

test("fiche client : montants facturés, encaissés, impayés ; suppression refusée", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients?q=atelier");
  await page.locator("table").getByRole("link", { name: CLIENT }).click();
  // Facturé : 1'490 + 1'200 (acompte) + 2'800 (solde final) ; la facture annulée ne compte pas.
  const tile = (label: string) =>
    page.locator('[data-slot="card"]').filter({ hasText: label }).first();
  await expect(tile("Total facturé")).toContainText("CHF 5'490.00");
  await expect(tile("Encaissé")).toContainText("CHF 1'490.00");
  await expect(tile("Impayé")).toContainText("CHF 4'000.00");
  await expect(page.getByRole("link", { name: F(3) })).toBeVisible();

  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Supprimer définitivement" })
    .click();
  await expect(
    page.getByText("Ce client a 4 factures : il ne peut pas être supprimé."),
  ).toBeVisible();
});

test("modèles d'emails : variable inconnue refusée, objet personnalisé, plusieurs destinataires", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/emails");
  const subject = page.getByLabel("Objet — Français").nth(1); // section « Envoi d'une facture »
  // « Enregistrer » des modèles (la relance des devis a son propre bouton).
  const save = page.getByRole("button", { name: "Enregistrer", exact: true });
  await subject.fill("Facture {numro}");
  await save.click();
  await expect(page.getByText("Variable inconnue : {numro}")).toBeVisible();
  await subject.fill("Votre facture {numero} – {entreprise}");
  await save.click();
  await expect(page.getByText("Modèles d'emails enregistrés.")).toBeVisible();

  await page.goto("/factures");
  await page.getByRole("link", { name: F(3) }).click();
  await page.getByRole("button", { name: "Envoyer par email" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Objet")).toHaveValue(`Votre facture ${F(3)} – Devra Test`);
  await dialog.getByLabel("Destinataires").fill("pas-une-adresse");
  await dialog.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(dialog.getByText("Adresse email invalide : pas-une-adresse")).toBeVisible();

  await dialog.getByLabel("Destinataires").fill(`${CLIENT_EMAIL}, direction@atelier-velo.test`);
  await dialog.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(
    page.getByText(`Facture ${F(3)} envoyée à ${CLIENT_EMAIL}, direction@atelier-velo.test.`),
  ).toBeVisible();
  const email = await waitForEmail('to:"direction@atelier-velo.test"', `Votre facture ${F(3)}`);
  expect(email.To.map((t) => t.Address)).toEqual([CLIENT_EMAIL, "direction@atelier-velo.test"]);
  await expect(
    page.getByText(/a envoyé la facture par email à compta@atelier-velo\.test, direction@/),
  ).toBeVisible();
});

test("échec d'envoi : le devis reste un brouillon et l'échec est noté", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  const number = await newQuote(page, async () => {
    await page.getByRole("button", { name: "Ligne libre" }).click();
    await page.getByLabel("Désignation de la ligne 1").fill("Audit SEO");
    await page.getByLabel("Prix unitaire de la ligne 1").fill("350");
  });
  await page.getByRole("button", { name: "Envoyer par email" }).click();
  const dialog = page.getByRole("dialog");
  await setSmtpFailure(true);
  try {
    await dialog.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(dialog.locator('[data-slot="alert"]')).toContainText(
      "L'email n'a pas pu être envoyé",
    );
  } finally {
    await setSmtpFailure(false);
  }
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Échec de l'envoi/)).toBeVisible();

  // Nouvel essai : l'envoi réussit et le devis passe en « envoyé ».
  await page.getByRole("button", { name: "Envoyer par email" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText(`Devis ${number} envoyé à ${CLIENT_EMAIL}.`)).toBeVisible();
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();
});

test("lecture seule : consulte les factures sans pouvoir agir", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await invite(page, READER, "Lecture seule");
  await logout(page);
  await acceptInvitation(page, READER);

  await page.goto("/factures");
  await expect(page.getByRole("link", { name: "Nouvelle facture" })).toHaveCount(0);
  await page.goto(firstInvoiceUrl);
  await expect(page.getByRole("heading", { name: `Facture ${F(1)}` })).toBeVisible();
  await expect(page.getByRole("link", { name: "Aperçu PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Autres actions" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Envoyer par email" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Supprimer le paiement/ })).toHaveCount(0);
  const pdf = await page.request.get(`/api/factures/${firstInvoiceUrl.split("/").pop()}/pdf`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
});
