import ExcelJS from "exceljs";
import { unzipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, login } from "./fixtures";

// Export comptable (Excel, CSV, ZIP des PDF) et journal d'activité. Les
// factures de ce test sont datées de 2019 : l'export de l'année 2019 ne
// contient qu'elles. S'exécute après tableau-de-bord.spec.ts (ordre alphabétique).
test.describe.configure({ mode: "serial" });

const CLIENT = "Archives Comptables SA";
const PERIOD = "du=2019-01-01&au=2019-12-31";
const numbers = { paid: "", cancelled: "" };

/** Facture émise à la date indiquée ; renvoie son numéro et son adresse. */
async function issuedInvoice(page: Page, date: string, label: string, price: string) {
  await page.goto("/factures/nouvelle");
  await page.getByRole("combobox", { name: "Client" }).click();
  await page.getByPlaceholder("Rechercher un client…").fill("archives comptables");
  await page.getByRole("option", { name: CLIENT }).click();
  await page.getByLabel("Date de la facture").fill(date);
  await page.getByRole("button", { name: "Ligne libre" }).click();
  await page.getByLabel("Désignation de la ligne 1").fill(label);
  await page.getByLabel("Prix unitaire de la ligne 1").fill(price);
  await page.getByRole("button", { name: "Créer le brouillon" }).first().click();
  await expect(page.getByText("Brouillon de facture enregistré.")).toBeVisible();
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name: "Émettre sans envoyer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Émettre" }).click();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(/^Facture F-2019-\d{3}$/);
  return (await heading.textContent())!.replace("Facture ", "");
}

test("préparation : deux factures de 2019, un paiement et une annulation", async ({ page }) => {
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

  await page.goto("/clients/nouveau");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(CLIENT);
  await page.getByLabel("NPA").fill("1950");
  await page.getByLabel("Localité").fill("Sion");
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name: CLIENT })).toBeVisible();

  numbers.paid = await issuedInvoice(page, "2019-05-10", "Site vitrine", "1250");
  await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Date du paiement").fill("2019-05-20");
  await dialog.getByRole("button", { name: "Enregistrer le paiement" }).click();
  await expect(page.getByText(`la facture ${numbers.paid} est payée`)).toBeVisible();

  numbers.cancelled = await issuedInvoice(page, "2019-06-15", "Maintenance", "120");
  await page.getByRole("button", { name: "Autres actions" }).click();
  await page.getByRole("menuitem", { name: "Annuler la facture" }).click();
  const cancel = page.getByRole("alertdialog");
  await cancel.getByLabel("Motif de l'annulation").fill("Facturée par erreur");
  await cancel.getByRole("button", { name: "Annuler la facture" }).click();
  await expect(page.getByText(`Facture ${numbers.cancelled} annulée.`)).toBeVisible();
});

test("export comptable : période, Excel, CSV et PDF en ZIP", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/factures");
  await page.getByRole("link", { name: "Export comptable" }).click();
  await expect(page.getByRole("heading", { name: "Export comptable" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Année en cours" })).toHaveAttribute(
    "aria-current",
    "true",
  );

  // Dates incohérentes.
  await page.getByLabel("Du", { exact: true }).fill("2019-12-31");
  await page.getByLabel("Au", { exact: true }).fill("2019-01-01");
  await page.getByRole("button", { name: "Afficher", exact: true }).click();
  await expect(page.getByText("La date de début doit précéder la date de fin.")).toBeVisible();

  await page.getByLabel("Du", { exact: true }).fill("2019-01-01");
  await page.getByLabel("Au", { exact: true }).fill("2019-12-31");
  await page.getByRole("button", { name: "Afficher", exact: true }).click();
  await expect(
    page.getByText(
      "Période : du 01.01.2019 au 31.12.2019 · 2 factures émises, 1 paiement, 0 relance.",
    ),
  ).toBeVisible();

  // Classeur Excel : trois feuilles, montants en nombres.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Classeur Excel/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Comptabilite_2019-01-01_2019-12-31.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await file.path());
  expect(workbook.worksheets.map((s) => s.name)).toEqual(["Factures", "Paiements", "Clients"]);
  const invoices = workbook.getWorksheet("Factures")!;
  expect(invoices.rowCount).toBe(3);
  expect(invoices.getRow(2).getCell(1).value).toBe(numbers.paid);
  expect(invoices.getRow(2).getCell(3).value).toBe("Payée");
  expect(invoices.getRow(2).getCell(14).value).toBe(1250);
  expect(invoices.getRow(3).getCell(3).value).toBe("Annulée");
  expect(invoices.getRow(3).getCell(22).value).toBe("Facturée par erreur");
  const payments = workbook.getWorksheet("Paiements")!;
  expect(payments.getRow(2).getCell(2).value).toBe(numbers.paid);
  expect(payments.getRow(2).getCell(4).value).toBe(1250);
  expect(payments.getRow(2).getCell(5).value).toBe("Virement");

  // CSV : séparateur point-virgule, montants « 1250.00 », dates JJ.MM.AAAA.
  const csv = await page.request.get(`/api/export/comptable?${PERIOD}&format=csv&jeu=factures`);
  expect(csv.headers()["content-disposition"]).toContain("Factures_2019-01-01_2019-12-31.csv");
  const lines = (await csv.text()).replace(/^﻿/, "").trim().split("\r\n");
  expect(lines).toHaveLength(3);
  expect(lines[0]).toMatch(/^Numéro;Type;Statut;Date;Échéance;Client;/);
  expect(lines[1]).toContain(`${numbers.paid};Facture;Payée;10.05.2019;`);
  expect(lines[1]).toContain(";1250.00;");
  const clients = await page.request.get(`/api/export/comptable?${PERIOD}&format=csv&jeu=clients`);
  const clientLines = (await clients.text()).trim().split("\r\n");
  expect(clientLines).toHaveLength(2);
  expect(clientLines[1]).toContain(`${CLIENT};Entreprise;`);
  expect(clientLines[1]).toMatch(/;1250\.00;1250\.00;0\.00$/);

  // ZIP des PDF : les deux factures émises, rangées dans « factures ».
  const zip = await page.request.get(`/api/export/pdf?${PERIOD}`);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  const entries = unzipSync(new Uint8Array(await zip.body()));
  expect(Object.keys(entries).sort()).toEqual([
    `factures/DevraTest_Facture_${numbers.paid}_ArchivesComptablesSA.pdf`,
    `factures/DevraTest_Facture_${numbers.cancelled}_ArchivesComptablesSA.pdf`,
  ]);
  for (const bytes of Object.values(entries)) {
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
  }
  await expect(
    page.getByRole("link", { name: "Télécharger les PDF (ZIP, 2 fichiers)" }),
  ).toBeVisible();
});

test("journal d'activité : recherche, type, lien vers le document", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/journal");
  await expect(page.getByRole("list", { name: "Activités" })).toBeVisible();

  await page.getByLabel("Rechercher dans le journal").fill(numbers.paid);
  const entries = page.getByRole("list", { name: "Activités" }).getByRole("listitem");
  await expect(entries.first()).toContainText(
    `${ADMIN.name} a enregistré un paiement de CHF 1'250.00 (Virement) sur la facture ${numbers.paid}`,
  );
  await expect(entries.filter({ hasText: `a émis la facture ${numbers.paid}` })).toHaveCount(1);
  await entries.first().getByRole("link", { name: "Ouvrir" }).click();
  await expect(page.getByRole("heading", { name: `Facture ${numbers.paid}` })).toBeVisible();

  await page.goto("/parametres/journal?type=exports");
  const exports = page.getByRole("list", { name: "Activités" }).getByRole("listitem");
  await expect(
    exports.filter({ hasText: "a téléchargé les PDF du 01.01.2019 au 31.12.2019 (2 fichier(s))" }),
  ).toHaveCount(1);
  await expect(
    exports.filter({ hasText: "a exporté la comptabilité (factures, paiements, clients, XLSX)" }),
  ).toHaveCount(1);
  await expect(exports.filter({ hasText: "a exporté la comptabilité (clients, CSV)" })).toHaveCount(
    1,
  );
});
