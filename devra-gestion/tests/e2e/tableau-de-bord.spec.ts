import { expect, test, type Page } from "@playwright/test";
import { acceptInvitation, ADMIN, invite, login, logout } from "./fixtures";

// Tableau de bord. Les factures de ce test sont datées de février et mars 2020 :
// une période personnalisée sur mars 2020 ne contient qu'elles, ce qui permet
// de vérifier les chiffres exactement, quelles que soient les données créées
// par les autres tests. S'exécute après subscriptions-reminders.spec.ts (ordre
// alphabétique) : ses factures en retard ne faussent pas les relances testées là.
test.describe.configure({ mode: "serial" });

const URI = "Fromagerie d'Altdorf SA";
const JURA = "Horlogerie Delémont Sàrl";
const READER = {
  name: "Tara Lecture",
  email: "tara@e2e-dashboard.test",
  password: "Tara-Pass-2026",
};
const MARCH_2020 = "/?periode=personnalise&du=2020-03-01&au=2020-03-31";

const numbers: Record<"february" | "march" | "jura", string> = {
  february: "",
  march: "",
  jura: "",
};

function kpi(page: Page, title: string) {
  return page
    .getByRole("region", { name: "Indicateurs" })
    .locator('[data-slot="card"]')
    .filter({ hasText: title });
}

async function newClient(page: Page, name: string, city: [string, string], canton: string) {
  await page.goto("/clients/nouveau");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(name);
  await page.getByLabel("Rue").fill("Rue Principale");
  await page.getByLabel("Numéro").fill("1");
  await page.getByLabel("NPA").fill(city[0]);
  await page.getByLabel("Localité").fill(city[1]);
  await page.getByRole("combobox", { name: "Canton", exact: true }).click();
  await page.getByRole("option", { name: canton }).click();
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** Facture émise à la date indiquée ; renvoie son numéro. */
async function issuedInvoice(
  page: Page,
  client: { search: string; name: string },
  date: string,
  price: string,
  siteType?: string,
) {
  await page.goto("/factures/nouvelle");
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByPlaceholder("Rechercher un client…").fill(client.search);
  await page.getByRole("option", { name: client.name }).click();
  await page.getByLabel("Date de la facture").fill(date);
  if (siteType) {
    await page.getByRole("combobox", { name: "Type de site" }).click();
    await page.getByRole("option", { name: siteType, exact: true }).click();
  }
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 1").fill("Création du site");
  await page.getByLabel("Prix unitaire de la ligne 1").fill(price);
  await page.getByRole("button", { name: "Créer le brouillon" }).first().click();
  await expect(page.getByText("Brouillon de facture enregistré.")).toBeVisible();
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name: "Émettre sans envoyer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Émettre" }).click();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(/^Facture F-2020-\d{3}$/);
  return (await heading.textContent())!.replace("Facture ", "");
}

test("préparation : entreprise, deux clients et des factures de 2020", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/entreprise");
  await page.getByLabel("Nom de l'entreprise").fill("Devra Test");
  await page.getByLabel("Rue").fill("Rue du Lac");
  await page.getByLabel("Numéro").fill("12");
  await page.getByLabel("NPA").fill("1003");
  await page.getByLabel("Localité").fill("Lausanne");
  await page.getByLabel("IBAN", { exact: true }).fill("CH93 0076 2011 6238 5295 7");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de l'entreprise enregistrées.")).toBeVisible();

  await newClient(page, URI, ["6460", "Altdorf"], "Uri (UR)");
  await newClient(page, JURA, ["2800", "Delémont"], "Jura (JU)");

  const uri = { search: "fromagerie altdorf", name: URI };
  numbers.february = await issuedInvoice(page, uri, "2020-02-10", "500");
  numbers.march = await issuedInvoice(page, uri, "2020-03-10", "1000", "Vitrine");
  // Paiement partiel pendant la période.
  await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Date du paiement").fill("2020-03-20");
  await dialog.getByLabel("Montant").fill("400");
  await dialog.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await expect(
    page.getByText("Paiement de CHF 400.00 enregistré. Solde : CHF 600.00."),
  ).toBeVisible();

  numbers.jura = await issuedInvoice(
    page,
    { search: "horlogerie delemont", name: JURA },
    "2020-03-15",
    "250",
    "E-commerce",
  );
});

test("indicateurs d'une période personnalisée, comparés à la période précédente", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(MARCH_2020);
  await expect(page.getByRole("link", { name: "Personnalisé", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByText(
      "Période : du 01.03.2020 au 31.03.2020 · comparaison : du 30.01.2020 au 29.02.2020",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Du", { exact: true })).toHaveValue("2020-03-01");

  // Facturé : 1'000 + 250 en mars, contre 500 en février.
  const invoiced = kpi(page, "Chiffre d'affaires facturé");
  await expect(invoiced).toContainText("CHF 1'250.00");
  await expect(invoiced).toContainText("+150 %");
  await expect(invoiced).toContainText("période précédente : CHF 500.00");
  await expect(invoiced).toContainText("2 factures émises");
  const paid = kpi(page, "Encaissé");
  await expect(paid).toContainText("CHF 400.00");
  await expect(paid).toContainText("période précédente : CHF 0.00");
  await expect(kpi(page, "Taux de conversion des devis")).toContainText(
    "Aucun devis envoyé pendant la période",
  );

  const top = page.getByRole("list", { name: "Meilleurs clients" }).getByRole("listitem");
  await expect(top).toHaveCount(2);
  await expect(top.nth(0)).toContainText(URI);
  await expect(top.nth(0)).toContainText("CHF 1'000.00");
  await expect(top.nth(1)).toContainText(JURA);
  await expect(top.nth(1)).toContainText("CHF 250.00");

  const sold = page.getByRole("list", { name: "Types de site vendus" }).getByRole("listitem");
  await expect(sold).toHaveCount(2);
  await expect(sold.nth(0)).toContainText("Vitrine");
  await expect(sold.nth(0)).toContainText("CHF 1'000.00");
  await expect(sold.nth(1)).toContainText("E-commerce");

  // Zones d'action : CA de la période et clients, par canton puis par localité.
  const cantons = page.getByRole("list", { name: "Cantons" }).getByRole("listitem");
  await expect(cantons.nth(0)).toContainText("Uri (UR)");
  await expect(cantons.nth(0)).toContainText("CHF 1'000.00");
  await expect(cantons.nth(0)).toContainText("1 client");
  await expect(cantons.nth(1)).toContainText("Jura (JU)");
  await expect(cantons.nth(1)).toContainText("CHF 250.00");
  await page.getByRole("tab", { name: "Localités" }).click();
  const cities = page.getByRole("list", { name: "Localités" }).getByRole("listitem");
  await expect(cities.nth(0)).toContainText("6460 Altdorf");
  await expect(cities.nth(1)).toContainText("2800 Delémont");

  // Les factures de 2020 sont les plus anciennes en retard.
  const overdue = page.getByRole("list", { name: "Factures en retard" }).getByRole("listitem");
  await expect(overdue.nth(0)).toContainText(numbers.february);
  await expect(overdue.nth(0)).toContainText("CHF 500.00");
  await expect(overdue.nth(1)).toContainText(numbers.march);
  await expect(overdue.nth(1)).toContainText("CHF 600.00");

  // Les 12 derniers mois (tableau lu par les lecteurs d'écran).
  await expect(page.locator("table caption")).toHaveText("Chiffre d'affaires des 12 derniers mois");
  await expect(page.locator("table tbody tr")).toHaveCount(12);
});

test("choix de la période : liens, formulaire et dates incohérentes", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page.getByRole("link", { name: "Mois", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("link", { name: "Année", exact: true }).click();
  await expect(page).toHaveURL("/?periode=annee");
  await expect(page.getByText(/^Période : du 01\.01\.\d{4} au/)).toBeVisible();

  await page.getByRole("link", { name: "Personnalisé", exact: true }).click();
  await page.getByLabel("Du", { exact: true }).fill("2020-03-01");
  await page.getByLabel("Au", { exact: true }).fill("2020-03-31");
  await page.getByRole("button", { name: "Afficher", exact: true }).click();
  await expect(page).toHaveURL(MARCH_2020);
  await expect(kpi(page, "Chiffre d'affaires facturé")).toContainText("CHF 1'250.00");

  await page.goto("/?periode=personnalise&du=2020-03-31&au=2020-03-01");
  await expect(
    page.getByText("La date de début doit précéder la date de fin : le mois en cours est affiché."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Mois", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("raccourci : enregistrer un paiement depuis le tableau de bord", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Numéro de facture ou client…").fill(numbers.jura);
  await dialog.getByRole("option", { name: new RegExp(numbers.jura) }).click();
  await expect(
    dialog.getByText(`Facture ${numbers.jura} · ${JURA} · solde CHF 250.00`),
  ).toBeVisible();
  // « Retour » revient à la liste des factures.
  await dialog.getByRole("button", { name: "Retour" }).click();
  await dialog.getByPlaceholder("Numéro de facture ou client…").fill("horlogerie");
  await dialog.getByRole("option", { name: new RegExp(numbers.jura) }).click();
  await expect(dialog.getByLabel("Montant")).toHaveValue("250.00");
  await dialog.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await expect(
    page.getByText(`Paiement de CHF 250.00 enregistré : la facture ${numbers.jura} est payée.`),
  ).toBeVisible();

  // La facture payée n'est plus proposée.
  await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
  await page
    .getByRole("dialog")
    .getByPlaceholder("Numéro de facture ou client…")
    .fill(numbers.jura);
  await expect(page.getByRole("dialog").getByText("Aucune facture trouvée.")).toBeVisible();
});

test("lecture seule : consulte le tableau de bord, sans raccourcis", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await invite(page, READER, "Lecture seule");
  await logout(page);
  await acceptInvitation(page, READER);

  await page.goto(MARCH_2020);
  await expect(kpi(page, "Chiffre d'affaires facturé")).toContainText("CHF 1'250.00");
  await expect(page.getByRole("link", { name: "Nouveau devis" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Nouveau client" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enregistrer un paiement" })).toHaveCount(0);
});
