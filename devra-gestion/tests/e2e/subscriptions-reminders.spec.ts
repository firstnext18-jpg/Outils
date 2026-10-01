import { expect, test, type Page } from "@playwright/test";
import {
  acceptInvitation,
  ADMIN,
  CRON_SECRET,
  deleteEmailsTo,
  invite,
  login,
  logout,
  waitForEmail,
} from "./fixtures";

// Abonnements (depuis un devis ou directement), tâches quotidiennes (bouton et
// route appelée par le conteneur cron) et relances (manuelles, par courrier,
// automatiques). S'exécute après sales.spec.ts et settings.spec.ts (ordre
// alphabétique) : les numéros de factures sont donc lus à l'écran.
test.describe.configure({ mode: "serial" });

const CLIENT = "Boulangerie Port SA";
const CLIENT_EMAIL = "compta@boulangerie-port.test";
const READER = {
  name: "Rémi Lecture",
  email: "remi@e2e-suivi.test",
  password: "Remi-Password-2026",
};

let quoteSubscriptionUrl = "";
let directSubscriptionUrl = "";
let remindedInvoiceUrl = "";

/** Date (AAAA-MM-JJ) décalée de `days` jours par rapport à aujourd'hui, à Zurich. */
function zurichDate(days: number) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** AAAA-MM-JJ → JJ.MM.AAAA */
function swiss(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function amount(page: Page, label: string | RegExp) {
  return page
    .locator("dl > div")
    .filter({ has: page.locator("dt", { hasText: label }) })
    .locator("dd");
}

function info(page: Page, label: string) {
  return page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
}

function card(page: Page, title: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.locator('[data-slot="card-title"]', { hasText: title }) });
}

/** Carte « MRR » ou « revenu annuel » de la page Abonnements. */
function revenue(page: Page, label: "mensuel" | "annuel") {
  return page.locator('[data-slot="card"]').filter({ hasText: `Revenu récurrent ${label}` });
}

async function pickClient(page: Page) {
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByPlaceholder("Rechercher un client…").fill("boulangerie port");
  await page.getByRole("option", { name: CLIENT }).click();
}

async function otherAction(page: Page, name: string) {
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name }).click();
}

/** Émet le brouillon affiché et renvoie le numéro attribué. */
async function issue(page: Page) {
  await otherAction(page, "Émettre sans envoyer");
  await page.getByRole("alertdialog").getByRole("button", { name: "Émettre" }).click();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(/^Facture( d'abonnement)? F-\d{4}-\d{3}$/);
  return (await heading.textContent())!.split(" ").pop()!;
}

/** Facture émise il y a 60 jours (donc échue), d'une seule ligne. */
async function overdueInvoice(page: Page, label: string, price: string) {
  await page.goto("/factures/nouvelle");
  await pickClient(page);
  await page.getByLabel("Date de la facture").fill(zurichDate(-60));
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 1").fill(label);
  await page.getByLabel("Prix unitaire de la ligne 1").fill(price);
  await page.getByRole("button", { name: "Créer le brouillon" }).first().click();
  await expect(page.getByText("Brouillon de facture enregistré.")).toBeVisible();
  const number = await issue(page);
  await expect(page.getByText("En retard", { exact: true })).toBeVisible();
  return { number, url: new URL(page.url()).pathname };
}

/** Dernière exécution affichée dans Paramètres → Tâches. */
function lastRun(page: Page) {
  return card(page, "Tâches quotidiennes").locator("li").first();
}

/** Lance les tâches quotidiennes et renvoie le compte rendu affiché. */
async function runDailyTasks(page: Page) {
  await page.goto("/parametres/taches");
  await page.getByRole("button", { name: "Lancer maintenant" }).click();
  await expect(page.getByText("Tâches quotidiennes exécutées.")).toBeVisible();
  const last = lastRun(page);
  await expect(last).toContainText(`lancé par ${ADMIN.name}`);
  return last;
}

test("préparation : entreprise, client et paramètres des relances", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/entreprise");
  await page.getByLabel("Nom de l'entreprise").fill("Devra Suivi");
  await page.getByLabel("Rue").fill("Rue du Lac");
  await page.getByLabel("Numéro").fill("12");
  await page.getByLabel("NPA").fill("1003");
  await page.getByLabel("Localité").fill("Lausanne");
  await page.getByLabel("IBAN", { exact: true }).fill("CH93 0076 2011 6238 5295 7");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de l'entreprise enregistrées.")).toBeVisible();

  await page.goto("/clients/nouveau");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(CLIENT);
  await page.getByLabel("Rue").fill("Quai du Port");
  await page.getByLabel("Numéro").fill("7");
  await page.getByLabel("NPA").fill("1820");
  await page.getByLabel("Localité").fill("Montreux");
  await page.getByLabel("Email").fill(CLIENT_EMAIL);
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name: CLIENT })).toBeVisible();

  // Texte de relance : une variable inconnue est refusée.
  await page.goto("/parametres/relances");
  await expect(page.getByRole("radio", { name: "Manuel" })).toBeChecked();
  await expect(page.getByLabel("Délai (jours)").first()).toHaveValue("10");
  const text = page.getByLabel("Texte — Français").first();
  await text.fill("Merci de verser {montnt}.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Variable inconnue : {montnt}")).toBeVisible();

  // Frais de CHF 20.00 au 2e rappel ; le texte par défaut est conservé.
  await page.reload();
  await page.getByLabel("Frais (CHF)").nth(1).fill("20");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres des relances enregistrés.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Frais (CHF)").nth(1)).toHaveValue("20.00");
  await expect(page.getByLabel("Texte — Français").first()).toHaveValue(/^Bonjour,/);
});

test("abonnement créé depuis un devis accepté, facturé par les tâches quotidiennes", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/devis/nouveau");
  await pickClient(page);
  await page.getByRole("button", { name: "Ajouter depuis le catalogue" }).click();
  const picker = page.getByRole("dialog");
  await picker
    .getByRole("option")
    .filter({ has: page.getByText("Hébergement + maintenance", { exact: true }) })
    .click();
  await picker.getByRole("button", { name: "Terminé" }).click();
  await page.getByRole("button", { name: "Créer le devis" }).first().click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  const quoteUrl = new URL(page.url()).pathname;
  await otherAction(page, "Marquer comme envoyé");
  await expect(page.getByText("Envoyé", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Marquer comme accepté" }).click();
  await expect(page.getByText("Accepté", { exact: true })).toBeVisible();

  // Un devis qui ne contient que des abonnements : pas de facture, un abonnement.
  await expect(page.getByRole("button", { name: "Créer la facture" })).toHaveCount(0);
  await page.getByRole("button", { name: "Créer l'abonnement" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Date de début")).toHaveValue(zurichDate(0));
  await dialog.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByText("Abonnement créé.")).toBeVisible();
  await expect(page).toHaveURL(/\/abonnements\/[0-9a-f-]{36}$/);
  quoteSubscriptionUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: "Hébergement + maintenance" })).toBeVisible();
  await expect(page.getByText("Actif", { exact: true })).toBeVisible();
  await expect(card(page, "Montant")).toContainText("CHF 29.00 / mois");
  await expect(info(page, "Prochaine facture")).toHaveText(swiss(zurichDate(0)));

  // Le devis affiche son abonnement et ne propose plus d'en créer un.
  await page.goto(quoteUrl);
  await expect(page.getByRole("link", { name: "Hébergement + maintenance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer l'abonnement" })).toHaveCount(0);

  await page.goto("/abonnements");
  await expect(revenue(page, "mensuel")).toContainText("CHF 29.00");
  await expect(revenue(page, "annuel")).toContainText("CHF 348.00");

  // Première exécution : la période en cours est facturée (en brouillon).
  const run = await runDailyTasks(page);
  await expect(run).toContainText("1 facture(s) d'abonnement");
  // Deuxième exécution : rien n'est facturé deux fois.
  const again = await runDailyTasks(page);
  await expect(again).toContainText("0 facture(s) d'abonnement");

  await page.goto(quoteSubscriptionUrl);
  await expect(info(page, "Périodes facturées")).toHaveText("1");
  await expect(info(page, "Prochaine facture")).not.toHaveText(swiss(zurichDate(0)));
  await page.getByRole("link", { name: "Brouillon" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Facture d'abonnement (brouillon)" }),
  ).toBeVisible();
  await expect(info(page, "Période")).toContainText(`${swiss(zurichDate(0))} –`);
  await expect(page.getByText("Hébergement + maintenance").first()).toBeVisible();
  await expect(amount(page, /^Total$/)).toHaveText("CHF 29.00");
  const number = await issue(page);
  await expect(page.getByRole("link", { name: "Hébergement + maintenance" })).toBeVisible();

  await page.goto(quoteSubscriptionUrl);
  await expect(page.getByRole("link", { name: number })).toBeVisible();
});

test("abonnement saisi directement : rattrapage des périodes, pause, reprise, résiliation", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/abonnements/nouveau");
  await pickClient(page);
  await page.getByLabel("Libellé").fill("Mises à jour trimestrielles");
  await page.getByRole("combobox", { name: "Périodicité" }).click();
  await page.getByRole("option", { name: "Trimestriel" }).click();
  // Commencé il y a 100 jours : deux trimestres ont déjà commencé.
  const start = zurichDate(-100);
  await page.getByLabel("Date de début").fill(start);
  await page.getByRole("button", { name: "Créer l'abonnement" }).first().click();
  await expect(page.getByText("Ajoutez au moins une prestation")).toBeVisible();

  await page.getByRole("button", { name: "Prestation libre" }).click();
  await page.getByLabel("Désignation de la prestation 1").fill("Mises à jour et sauvegardes");
  await page.getByLabel("Prix de la prestation 1").fill("150");
  await expect(page.getByLabel("Montant par période")).toHaveText("CHF 150.00");
  await page.getByRole("button", { name: "Créer l'abonnement" }).first().click();
  await expect(page.getByText("Abonnement créé.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mises à jour trimestrielles" })).toBeVisible();
  directSubscriptionUrl = new URL(page.url()).pathname;
  await expect(info(page, "Prochaine facture")).toHaveText(swiss(start));

  // MRR : 29.00 + 150.00 / 3 ; revenu annuel : 348.00 + 600.00.
  await page.goto("/abonnements");
  await expect(revenue(page, "mensuel")).toContainText("CHF 79.00");
  await expect(revenue(page, "annuel")).toContainText("CHF 948.00");

  const run = await runDailyTasks(page);
  await expect(run).toContainText("2 facture(s) d'abonnement");

  await page.goto(directSubscriptionUrl);
  await expect(info(page, "Périodes facturées")).toHaveText("2");
  await expect(page.getByRole("link", { name: "Brouillon" })).toHaveCount(2);
  // Une fois facturé, la date de début et la périodicité ne changent plus.
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(page.getByLabel("Date de début")).toBeDisabled();
  await page.getByLabel("Prix de la prestation 1").fill("160");
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await expect(page.getByText("Abonnement enregistré.")).toBeVisible();
  await expect(card(page, "Montant")).toContainText("CHF 160.00 / trimestre");

  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByText("Abonnement mis en pause.")).toBeVisible();
  await expect(page.getByText("En pause", { exact: true })).toBeVisible();
  await expect(info(page, "Prochaine facture")).toHaveCount(0);
  await page.goto("/abonnements");
  await expect(revenue(page, "mensuel")).toContainText("CHF 29.00");

  // Reprise : la période en cours est déjà facturée, la suivante le sera à son début.
  await page.goto(directSubscriptionUrl);
  await page.getByRole("button", { name: "Reprendre" }).click();
  await expect(page.getByText("Abonnement repris.")).toBeVisible();
  await expect(page.getByText("Actif", { exact: true })).toBeVisible();
  await expect(await runDailyTasks(page)).toContainText("0 facture(s) d'abonnement");

  await page.goto(directSubscriptionUrl);
  await otherAction(page, "Résilier");
  await page.getByRole("alertdialog").getByRole("button", { name: "Résilier" }).click();
  await expect(page.getByText("Abonnement résilié.")).toBeVisible();
  await expect(page.getByText("Résilié", { exact: true })).toBeVisible();
  await expect(info(page, "Résilié le")).toHaveText(swiss(zurichDate(0)));
  await expect(page.getByRole("button", { name: "Autres actions" })).toHaveCount(0);

  await page.goto("/abonnements?statut=resilies");
  await expect(page.getByRole("link", { name: "Mises à jour trimestrielles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hébergement + maintenance" })).toHaveCount(0);
});

test("un abonnement jamais facturé peut être supprimé", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/abonnements/nouveau");
  await pickClient(page);
  await page.getByLabel("Libellé").fill("Abonnement à supprimer");
  await page.getByLabel("Date de début").fill(zurichDate(30));
  await page.getByRole("button", { name: "Prestation libre" }).click();
  await page.getByLabel("Désignation de la prestation 1").fill("Veille technique");
  await page.getByLabel("Prix de la prestation 1").fill("40");
  await page.getByRole("button", { name: "Créer l'abonnement" }).first().click();
  await expect(page.getByText("Abonnement créé.")).toBeVisible();
  await expect(
    page.getByText(`la première sera générée le ${swiss(zurichDate(30))}`),
  ).toBeVisible();
  await otherAction(page, "Supprimer");
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Abonnement supprimé.")).toBeVisible();
  await expect(page).toHaveURL("/abonnements");
  await expect(page.getByRole("link", { name: "Abonnement à supprimer" })).toHaveCount(0);
});

test("route des tâches quotidiennes : protégée par le secret du conteneur cron", async ({
  page,
  request,
}) => {
  const url = "/api/taches/quotidiennes";
  expect((await request.post(url)).status()).toBe(401);
  const wrong = await request.post(url, {
    headers: { Authorization: `Bearer ${"x".repeat(CRON_SECRET.length)}` },
  });
  expect(wrong.status()).toBe(401);

  const response = await request.post(url, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    summary: { subscriptionInvoices: number; reminders: { mode: string } };
    errors: string[];
  };
  expect(body.errors).toEqual([]);
  expect(body.summary.subscriptionInvoices).toBe(0);
  expect(body.summary.reminders.mode).toBe("MANUAL");

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/taches");
  await expect(lastRun(page)).toContainText("automatique");
});

test("relances manuelles : 1er rappel par email, 2e rappel par courrier avec frais", async ({
  page,
}) => {
  await deleteEmailsTo(CLIENT_EMAIL);
  await login(page, ADMIN.email, ADMIN.password);
  const { number, url } = await overdueInvoice(page, "Refonte de la carte des produits", "180");
  remindedInvoiceUrl = url;

  await page.goto("/factures");
  await page.getByRole("link", { name: /Relances à envoyer/ }).click();
  await expect(page).toHaveURL("/factures/relances");
  const row = page.getByRole("listitem").filter({ hasText: `Facture ${number}` });
  await expect(row).toContainText(CLIENT);
  await expect(row).toContainText("1er rappel");
  await expect(row).toContainText("à payer CHF 180.00");

  await row.getByRole("button", { name: "Envoyer : 1er rappel" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Envoyer : 1er rappel" })).toBeVisible();
  await expect(dialog.getByLabel("Destinataires")).toHaveValue(CLIENT_EMAIL);
  await expect(dialog.getByLabel("Objet")).toHaveValue(`Rappel – facture ${number}`);
  const newDueDate = swiss(zurichDate(10));
  await expect(dialog.getByLabel("Message")).toHaveValue(
    new RegExp(`le montant de CHF 180\\.00 d'ici au ${newDueDate.replaceAll(".", "\\.")}`),
  );
  const fileName = `DevraSuivi_Rappel-1_${number}_BoulangeriePortSA.pdf`;
  await expect(dialog.getByText(fileName)).toBeVisible();
  await dialog.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(
    page.getByText(`Relance de la facture ${number} envoyée à ${CLIENT_EMAIL}.`),
  ).toBeVisible();
  await expect(page.getByText("Aucune relance à envoyer")).toBeVisible();

  const email = await waitForEmail(`to:"${CLIENT_EMAIL}"`, `Rappel – facture ${number}`);
  expect(email.Attachments.map((a) => [a.FileName, a.ContentType])).toEqual([
    [fileName, "application/pdf"],
  ]);
  expect(email.Text).toContain(`notre facture ${number} du ${swiss(zurichDate(-60))}`);

  // Fiche de la facture : historique, puis 2e rappel envoyé par courrier, avant son terme.
  await page.goto(url);
  const reminders = card(page, "Relances");
  await expect(reminders).toContainText(`1er rappel du ${swiss(zurichDate(0))}`);
  await expect(reminders).toContainText(`CHF 180.00 d'ici au ${newDueDate}`);
  await expect(reminders).toContainText(`Envoyée par email · ${ADMIN.name}`);
  await expect(reminders).toContainText("Prochaine relance : 2e rappel, prévue le");
  await reminders.getByRole("button", { name: "Par courrier" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm.getByText("Relance par courrier : 2e rappel")).toBeVisible();
  await confirm.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByText("Relance enregistrée (2e rappel) : son PDF est prêt à imprimer."),
  ).toBeVisible();
  await expect(reminders).toContainText("CHF 200.00");
  await expect(reminders).toContainText("(frais CHF 20.00)");
  await expect(reminders).toContainText(`Par courrier · ${ADMIN.name}`);
  await expect(amount(page, "Frais de relance")).toHaveText("CHF 20.00");
  await expect(amount(page, "Solde")).toHaveText("CHF 200.00");
  await expect(reminders).toContainText("Prochaine relance : mise en demeure");

  // Les PDF des relances sont archivés et téléchargeables.
  const links = reminders.getByRole("link", { name: "PDF" });
  await expect(links).toHaveCount(2);
  const pdf = await page.request.get((await links.nth(1).getAttribute("href"))!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["content-disposition"]).toContain(
    `DevraSuivi_Rappel-2_${number}_BoulangeriePortSA.pdf`,
  );
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Le paiement du solde (frais compris) solde la facture et arrête les relances.
  await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
  const payment = page.getByRole("dialog");
  await expect(payment.getByLabel("Montant")).toHaveValue("200.00");
  await payment.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await expect(page.getByText(`la facture ${number} est payée`)).toBeVisible();
  await expect(page.getByText("Payée", { exact: true })).toBeVisible();
  await expect(reminders.getByRole("button", { name: "Par courrier" })).toHaveCount(0);
});

test("relances automatiques : envoyées par les tâches quotidiennes", async ({ page }) => {
  await deleteEmailsTo(CLIENT_EMAIL);
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/relances");
  await page.getByRole("radio", { name: "Automatique" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres des relances enregistrés.")).toBeVisible();

  const { number, url } = await overdueInvoice(page, "Hébergement annuel", "240");
  const run = await runDailyTasks(page);
  await expect(run).toContainText("1 relance(s) envoyée(s)");

  const email = await waitForEmail(`to:"${CLIENT_EMAIL}"`, `Rappel – facture ${number}`);
  expect(email.Attachments.map((a) => a.FileName)).toEqual([
    `DevraSuivi_Rappel-1_${number}_BoulangeriePortSA.pdf`,
  ]);
  await page.goto(url);
  await expect(card(page, "Relances")).toContainText("Envoyée par email · envoi automatique");

  // Nouvelle exécution : la relance n'est pas renvoyée.
  const again = await runDailyTasks(page);
  await expect(again).toContainText("0 relance(s) envoyée(s)");

  await page.goto("/parametres/relances");
  await page.getByRole("radio", { name: "Manuel" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres des relances enregistrés.")).toBeVisible();
});

test("lecture seule : consulte abonnements et relances sans pouvoir agir", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await invite(page, READER, "Lecture seule");
  await logout(page);
  await acceptInvitation(page, READER);

  await page.goto("/abonnements");
  await expect(page.getByRole("heading", { name: "Abonnements" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nouvel abonnement" })).toHaveCount(0);
  await page.goto(quoteSubscriptionUrl);
  await expect(page.getByRole("heading", { name: "Hébergement + maintenance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mettre en pause" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  await page.goto(`${directSubscriptionUrl}/modifier`);
  await expect(page).toHaveURL("/acces-refuse");

  await page.goto(remindedInvoiceUrl);
  await expect(card(page, "Relances")).toContainText("1er rappel du");
  await expect(page.getByRole("button", { name: "Par courrier" })).toHaveCount(0);
  const links = card(page, "Relances").getByRole("link", { name: "PDF" });
  const pdf = await page.request.get((await links.first().getAttribute("href"))!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  await page.goto("/parametres/taches");
  await expect(page.getByRole("button", { name: "Lancer maintenant" })).toHaveCount(0);
});
