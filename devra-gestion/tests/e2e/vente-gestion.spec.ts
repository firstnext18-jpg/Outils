import { expect, test, type Browser, type Page } from "@playwright/test";
import { acceptInvitation, ADMIN, CRON_SECRET, invite, login } from "./fixtures";

// Gestion courante : état du client, projet et avancement, suivi du temps
// facturé, import d'un relevé bancaire camt, dépense, site du client
// (renouvellements, calendrier, abonnement iCal, rappel), notifications lues
// par les applications de bureau et Android.
// S'exécute après vente-espace-client.spec.ts (ordre alphabétique) : les
// documents créés ici ne décalent pas la numérotation vérifiée ailleurs.
test.describe.configure({ mode: "serial" });

const CLIENT = { name: "Studio Projets SA", email: "contact@studio-projets.test" };
// Membre invité par ce fichier : ne doit rien voir de l'argent des associés.
const MEMBER = {
  name: "Léa Membre",
  email: "lea.apports@e2e.test",
  password: "Lea-E2E-Password",
};
const SITE_HOST = "www.studio-projets.invalid";

let clientUrl = "";
let projectUrl = "";
let invoiceNumber = "";

/** Date de Zurich dans `days` jours (AAAA-MM-JJ). */
function zurichDate(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
}

/** « CHF 1'250.00 » ↔ centimes (format suisse de l'outil). */
function chfToCents(text: string): number {
  const match = text.match(/CHF\s*(-)?([\d']+)\.(\d{2})/);
  if (!match) throw new Error(`Montant illisible : ${text}`);
  const cents = Number(match[2]!.replaceAll("'", "")) * 100 + Number(match[3]);
  return match[1] ? -cents : cents;
}

function chf(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const [whole, decimals] = (Math.abs(cents) / 100).toFixed(2).split(".");
  return `CHF ${sign}${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${decimals}`;
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

async function addPartnerMovement(
  page: Page,
  movement: {
    kind?: string;
    amount: string;
    description: string;
    file?: { name: string; mimeType: string; buffer: Buffer };
  },
) {
  await page.goto("/apports/nouveau");
  await page.waitForLoadState("networkidle");
  // L'admin connecté est proposé comme associé.
  await expect(page.locator("#partner-id")).toHaveText(ADMIN.name);
  if (movement.kind) {
    await page.locator("#partner-kind").click();
    await page.getByRole("option", { name: movement.kind }).click();
  }
  await page.getByLabel("Montant (CHF)").fill(movement.amount);
  await page.getByLabel("Description (facultatif)").fill(movement.description);
  if (movement.file) {
    await page.getByLabel("Joindre un relevé ou un contrat").setInputFiles(movement.file);
  }
  await page.getByRole("button", { name: "Ajouter le mouvement" }).click();
}

/** Le membre active son compte (invitation envoyée par l'admin) dans une session à part. */
async function memberSession(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await acceptInvitation(page, MEMBER);
  return { context, page };
}

test("apports des associés : soldes, remboursement limité, trésorerie, admins seulement", async ({
  page,
  browser,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/apports");
  await expect(page.getByText("Aucun apport pour l'instant")).toBeVisible();
  // Fonds de l'entreprise avant le premier apport (paiements et dépenses des autres tests).
  const funds = page.getByTestId("fonds-total");
  const before = chfToCents((await funds.textContent()) ?? "");

  await addPartnerMovement(page, {
    amount: "5000",
    description: "Apport initial",
    file: { name: "releve.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") },
  });
  await expect(page.getByText("Mouvement ajouté.")).toBeVisible();
  // Retour immédiat : les fonds de l'entreprise après l'apport.
  await expect(page.getByText(`Fonds de Devra Test : ${chf(before + 500_000)}`)).toBeVisible();
  await expect(page).toHaveURL(/\/apports$/);
  await expect(funds).toHaveText(chf(before + 500_000));
  await addPartnerMovement(page, {
    kind: "Prêt d'associé",
    amount: "2000",
    description: "Prêt pour le matériel",
  });
  await expect(page).toHaveURL(/\/apports$/);

  // On ne rend jamais plus que le prêt restant.
  await addPartnerMovement(page, {
    kind: "Remboursement du prêt",
    amount: "3000",
    description: "Premier remboursement",
  });
  await expect(
    page.getByText("Le remboursement dépasse le prêt restant de cet associé (CHF 2'000.00)."),
  ).toBeVisible();
  await page.getByLabel("Montant (CHF)").fill("500");
  await page.getByRole("button", { name: "Ajouter le mouvement" }).click();
  await expect(page).toHaveURL(/\/apports$/);
  // + 5'000 + 2'000 − 500 rendus.
  await expect(funds).toHaveText(chf(before + 650_000));

  const balances = page.getByRole("region", { name: "Soldes des associés" });
  await expect(balances).toContainText(ADMIN.name);
  await expect(balances).toContainText("CHF 5'000.00"); // capital
  await expect(balances).toContainText("CHF 1'500.00"); // prêt restant
  await expect(balances).toContainText("CHF 6'500.00"); // investi au total
  const list = page.getByRole("list", { name: "Mouvements" });
  await expect(list).toContainText("+ CHF 5'000.00");
  await expect(list).toContainText("− CHF 500.00");

  // Supprimer le prêt laisserait un remboursement sans prêt : refusé.
  await list.getByRole("link", { name: /Prêt pour le matériel/ }).click();
  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText(/aurait alors été remboursé de plus que son prêt/)).toBeVisible();

  // Justificatif de l'apport : lisible par les admins seulement.
  await page.goto("/apports");
  await list.getByRole("link", { name: /Apport initial/ }).click();
  const receipt = page.getByRole("link", { name: /releve\.pdf/ });
  await expect(receipt).toBeVisible();
  const receiptUrl = (await receipt.getAttribute("href"))!;
  expect((await page.request.get(receiptUrl)).status()).toBe(200);

  // Tableau de bord : trésorerie estimée (admins).
  await page.goto("/");
  const cash = page
    .getByRole("region", { name: "Indicateurs" })
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Trésorerie estimée", { exact: true }) });
  await expect(cash).toContainText("apports des associés (CHF 7'000.00)");
  await expect(cash).toContainText("remboursements (CHF 500.00)");

  // Un membre ne voit ni la page, ni le menu, ni les justificatifs, ni la carte.
  await invite(page, MEMBER, "Membre");
  const member = await memberSession(browser);
  await expect(member.page.getByRole("link", { name: "Apports", exact: true })).toHaveCount(0);
  await expect(member.page.getByText("Trésorerie estimée", { exact: true })).toHaveCount(0);
  await member.page.goto("/apports");
  await expect(member.page).toHaveURL(/\/acces-refuse/);
  expect((await member.page.request.get(receiptUrl)).status()).toBe(404);
  await member.context.close();
});

test("notifications des applications : réservées à l'utilisateur connecté", async ({ request }) => {
  const response = await request.get("/api/notifications");
  expect(response.status()).toBe(401);
  const monitor = await request.post("/api/taches/surveillance");
  expect(monitor.status()).toBe(401);
});
