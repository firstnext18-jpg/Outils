import { expect, test, type Page } from "@playwright/test";
import { ADMIN, CRON_SECRET, login } from "./fixtures";

// Gestion courante : état du client, projet et avancement, suivi du temps
// facturé, import d'un relevé bancaire camt, dépense, site du client
// (renouvellements, calendrier, abonnement iCal, rappel), notifications lues
// par les applications de bureau et Android.
// S'exécute après vente-espace-client.spec.ts (ordre alphabétique) : les
// documents créés ici ne décalent pas la numérotation vérifiée ailleurs.
test.describe.configure({ mode: "serial" });

const CLIENT = { name: "Studio Projets SA", email: "contact@studio-projets.test" };
const SITE_HOST = "www.studio-projets.invalid";

let clientUrl = "";
let projectUrl = "";
let invoiceNumber = "";

/** Date de Zurich dans `days` jours (AAAA-MM-JJ). */
function zurichDate(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
}

function swissDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

async function openClient(page: Page) {
  await page.goto(clientUrl);
  await expect(page.getByRole("heading", { name: CLIENT.name })).toBeVisible();
}

test("état du client, projet et avancement des étapes", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients/nouveau");
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(CLIENT.name);
  await page.getByLabel("Email").fill(CLIENT.email);
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name: CLIENT.name })).toBeVisible();
  clientUrl = new URL(page.url()).pathname;

  // État choisi dans la liste modifiable (Paramètres → Listes).
  await page.getByRole("combobox", { name: "État du client" }).click();
  await page.getByRole("option", { name: "Projet en cours" }).click();
  await expect(page.getByText("État du client enregistré.")).toBeVisible();

  await page.getByRole("link", { name: "Nouveau projet" }).click();
  await expect(page.getByRole("heading", { name: "Nouveau projet" })).toBeVisible();
  await page.getByLabel("Nom du projet").fill("Refonte du site");
  await page.getByLabel("Tarif horaire du projet (CHF, hors TVA)").fill("120");
  // Étapes proposées par défaut (Paramètres → Listes → Étapes de projet).
  const steps = page.getByRole("list", { name: "Étapes du projet" });
  await expect(steps.getByRole("textbox")).toHaveCount(5);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page.getByRole("heading", { name: "Refonte du site" })).toBeVisible();
  projectUrl = new URL(page.url()).pathname;

  await page.getByRole("checkbox", { name: "Terminer « Brief et contenus »" }).click();
  await expect(page.getByText("20 %")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Rouvrir « Brief et contenus »" })).toBeVisible();
});

test("temps saisi sur le projet, puis facturé", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto(projectUrl);
  await page.getByRole("button", { name: "Saisir du temps" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Durée").fill("1:30");
  await dialog.getByLabel("Description").fill("Maquette de la page d'accueil");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Temps enregistré.")).toBeVisible();
  await expect(page.getByText("Maquette de la page d'accueil")).toBeVisible();

  await page.goto("/temps");
  await page.getByRole("button", { name: `Facturer le temps de ${CLIENT.name}` }).click();
  await expect(page).toHaveURL(/\/factures\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Facture (brouillon)" })).toBeVisible();
  await expect(page.getByText("Refonte du site").first()).toBeVisible();

  await page.getByRole("button", { name: "Émettre et envoyer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Envoyer", exact: true }).click();
  const sent = page.getByText(new RegExp(`Facture (\\S+) envoyée à ${CLIENT.email}\\.`));
  await expect(sent).toBeVisible();
  invoiceNumber = (await sent.textContent())!.match(/Facture (\S+) envoyée/)![1]!;
});

test("relevé bancaire camt : paiement rapproché par le numéro de facture", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.08">
  <BkToCstmrDbtCdtNtfctn><Ntfctn><Ntry>
    <Amt Ccy="CHF">50.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts>
    <BookgDt><Dt>${zurichDate(0)}</Dt></BookgDt>
    <NtryDtls><TxDtls>
      <Refs><AcctSvcrRef>E2E-CAMT-1</AcctSvcrRef></Refs>
      <Amt Ccy="CHF">50.00</Amt>
      <RltdPties><Dbtr><Nm>${CLIENT.name}</Nm></Dbtr></RltdPties>
      <RmtInf><Ustrd>Acompte facture ${invoiceNumber}</Ustrd></RmtInf>
    </TxDtls></NtryDtls>
  </Ntry></Ntfctn></BkToCstmrDbtCdtNtfctn>
</Document>`;
  const file = { name: "releve.xml", mimeType: "application/xml", buffer: Buffer.from(xml) };

  await page.goto("/factures/import-bancaire");
  await page.getByLabel("Relevé bancaire (camt.053 ou camt.054)").setInputFiles(file);
  const credits = page.getByRole("list", { name: "Crédits du relevé" });
  await expect(credits).toContainText("CHF 50.00");
  await expect(credits).toContainText("N° de facture");
  await page.getByRole("button", { name: "Enregistrer 1 paiement(s)" }).click();
  await expect(page.getByText("1 paiement(s) enregistré(s).")).toBeVisible();
  await expect(page.getByRole("list", { name: "Résultat de l'import" })).toContainText(
    `${invoiceNumber} : CHF 50.00 enregistrés`,
  );

  // Le même relevé importé une seconde fois : rien n'est enregistré deux fois.
  await page.goto("/factures/import-bancaire");
  await page.getByLabel("Relevé bancaire (camt.053 ou camt.054)").setInputFiles(file);
  await expect(page.getByRole("list", { name: "Crédits du relevé" })).toContainText("Déjà importé");
});

test("dépense avec catégorie", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/depenses/nouvelle");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Description").fill("Hébergement annuel");
  await page.getByRole("textbox", { name: "Fournisseur" }).fill("Hébergeur Test");
  await page.getByLabel("Montant payé (CHF, TVA comprise)").fill("240.00");
  await page.locator("#expense-category").click();
  await page.getByRole("option", { name: "Hébergement et domaines" }).click();
  await page.getByRole("button", { name: "Ajouter la dépense" }).click();
  await expect(page.getByText("Dépense ajoutée.")).toBeVisible();
  await page.goto("/depenses");
  await expect(page.getByText("Hébergement annuel")).toBeVisible();
  await expect(page.getByText("CHF 240.00").first()).toBeVisible();
});

test("site du client : renouvellement, calendrier, abonnement iCal et rappel", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await openClient(page);
  await page.getByRole("link", { name: "Nouveau site" }).click();
  await expect(page.getByRole("heading", { name: "Nouveau site" })).toBeVisible();
  await page.getByLabel("Nom", { exact: true }).fill("Site vitrine");
  await page.getByLabel("Adresse du site").fill(SITE_HOST);
  const expires = zurichDate(10);
  await page.getByLabel("Expiration du domaine").fill(expires);
  // Pas d'accès aux registres ni au site pendant les tests.
  await page.getByRole("switch", { name: "Lire la date automatiquement chaque jour" }).click();
  await page.getByRole("switch", { name: /Vérifier le site toutes les quelques minutes/ }).click();
  await page.getByRole("button", { name: "Ajouter le site" }).click();
  await expect(page.getByText("Site ajouté.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Site vitrine" })).toBeVisible();
  await expect(page.getByText("Non surveillé")).toBeVisible();
  await expect(page.getByText(`Domaine · ${swissDate(expires)} (dans 10 jours)`)).toBeVisible();

  await openClient(page);
  await expect(page.getByRole("list", { name: "Sites" })).toContainText("Site vitrine");

  // Calendrier du mois de l'échéance.
  await page.goto(`/calendrier?mois=${expires.slice(0, 7)}`);
  const event = page.getByRole("link", {
    name: `Expiration du domaine studio-projets.invalid · ${CLIENT.name}`,
  });
  await expect(event).toBeVisible();

  // Abonnement iCal : l'adresse n'est affichée qu'une fois.
  await page.getByRole("button", { name: "Créer mon adresse d'abonnement" }).click();
  const feedUrl = await page.getByLabel("Adresse d'abonnement").inputValue();
  expect(feedUrl).toMatch(/\/api\/calendrier\/[A-Za-z0-9_-]{43}$/);
  const ics = await page.request.get(feedUrl);
  expect(ics.status()).toBe(200);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  const body = await ics.text();
  expect(body).toContain("BEGIN:VCALENDAR");
  expect(body).toContain(`DTSTART;VALUE=DATE:${expires.replaceAll("-", "")}`);
  expect((await page.request.get(feedUrl.replace(/.$/, "A"))).status()).toBe(404);

  // Tâches du matin : rappel de renouvellement enregistré comme notification.
  const before = await page.request.get("/api/notifications");
  const { latest } = (await before.json()) as { latest: number };
  const run = await page.request.post("/api/taches/quotidiennes", {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(run.status()).toBe(200);
  const after = await page.request.get(`/api/notifications?apres=${latest}`);
  const data = (await after.json()) as { notifications: { title: string; url: string }[] };
  expect(data.notifications.map((n) => n.title)).toContain(
    `Renouvellement · ${CLIENT.name} · Site vitrine`,
  );
});

test("notifications des applications : réservées à l'utilisateur connecté", async ({ request }) => {
  const response = await request.get("/api/notifications");
  expect(response.status()).toBe(401);
  const monitor = await request.post("/api/taches/surveillance");
  expect(monitor.status()).toBe(401);
});
