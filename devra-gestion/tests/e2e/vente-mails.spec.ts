import { expect, test, type Page } from "@playwright/test";
import nodemailer from "nodemailer";
import { ADMIN, login, MAILBOX, waitForEmail } from "./fixtures";

// Section Mail : email envoyé à un client (avec pièce jointe), réponse du
// client déposée dans la boîte relevée (GreenMail, IMAP), relève, lecture,
// message cité replié, pièce jointe reçue, carte de la fiche client et
// notification pour les applications.
// S'exécute après vente-gestion.spec.ts (ordre alphabétique).
test.describe.configure({ mode: "serial" });

// Adresse unique : la boîte de test garde les emails des lancements précédents.
const RUN = Date.now();
const CLIENT = { name: "Bureau Courriel SA", email: `client-${RUN}@courriel.test` };
const SUBJECT = `Votre nouveau site ${RUN}`;

let clientUrl = "";
let sentMessageId = "";

/** Le client écrit à la boîte relevée (SMTP de GreenMail). */
async function clientWrites(mail: {
  from: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  attachment?: { filename: string; content: Buffer };
}) {
  const transport = nodemailer.createTransport({
    host: "localhost",
    port: MAILBOX.smtpPort,
    secure: false,
  });
  await transport.sendMail({
    from: `Lucie Courriel <${mail.from}>`,
    to: MAILBOX.user,
    subject: mail.subject,
    text: mail.text,
    ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo, references: [mail.inReplyTo] } : {}),
    attachments: mail.attachment ? [mail.attachment] : [],
  });
}

async function syncNow(page: Page, expected: string) {
  await page.goto("/mails");
  await page.getByRole("button", { name: "Relever les mails" }).click();
  await expect(page.getByText(expected)).toBeVisible({ timeout: 15_000 });
}

test("email envoyé à un client depuis sa fiche, avec pièce jointe", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/clients/nouveau");
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: "Entreprise" }).click();
  await page.getByLabel("Raison sociale").fill(CLIENT.name);
  await page.getByLabel("Email").fill(CLIENT.email);
  await page.getByRole("button", { name: "Créer le client" }).click();
  await expect(page.getByRole("heading", { name: CLIENT.name })).toBeVisible();
  clientUrl = new URL(page.url()).pathname;
  await expect(page.getByText("Aucun email échangé avec ce client.")).toBeVisible();

  await page.getByRole("link", { name: "Écrire" }).click();
  await expect(page.getByRole("heading", { name: "Nouvel email" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Client" })).toHaveText(CLIENT.name);
  await page.getByLabel("Objet").fill(SUBJECT);
  await page.getByLabel("Message").fill("Bonjour,\n\nVoici la maquette de la page d'accueil.");
  await page.getByLabel("Joindre des fichiers").setInputFiles({
    name: "maquette.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%maquette\n"),
  });
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("Email envoyé.")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/mails/${clientUrl.split("/").pop()}$`));
  const thread = page.getByRole("list", { name: "Emails" });
  await expect(thread).toContainText("Voici la maquette de la page d'accueil.");
  await expect(thread).toContainText("Envoyé");
  await expect(thread.getByRole("link", { name: "maquette.pdf" })).toBeVisible();

  // Email reçu par le client : réponses vers la boîte relevée, signature de l'entreprise.
  const email = await waitForEmail(`to:"${CLIENT.email}"`, SUBJECT);
  expect(email.ReplyTo.map((r) => r.Address)).toEqual([MAILBOX.user]);
  expect(email.Attachments.map((a) => a.FileName)).toEqual(["maquette.pdf"]);
  expect(email.Text).toContain("Voici la maquette");
  expect(email.Text).toContain("Devra Test");
  sentMessageId = email.MessageID;
});

test("réponse du client relevée dans la boîte, lue dans la section Mail", async ({ page }) => {
  await clientWrites({
    from: CLIENT.email,
    subject: `Re: ${SUBJECT}`,
    text: `Merci, c'est parfait !\n\nLe mar. 24 nov. 2026 à 14:02, Devra Test a écrit :\n> Bonjour,\n> Voici la maquette.`,
    inReplyTo: `<${sentMessageId}>`,
    attachment: { filename: "plan.pdf", content: Buffer.from("%PDF-1.4\n%plan\n") },
  });
  // Un email d'une adresse inconnue n'est pas repris.
  await clientWrites({
    from: `inconnu-${RUN}@ailleurs.test`,
    subject: "Publicité",
    text: "Achetez",
  });

  await login(page, ADMIN.email, ADMIN.password);
  await syncNow(page, "1 nouvel(s) email(s) de client.");
  await expect(page.getByText(`Réponses relevées dans ${MAILBOX.user}`)).toBeVisible();
  const conversation = page
    .getByRole("list", { name: "Conversations" })
    .getByRole("listitem")
    .filter({ hasText: CLIENT.name });
  await expect(conversation).toContainText("Merci, c'est parfait !");
  await expect(conversation.getByLabel("1 email non lu")).toBeVisible();
  await expect(page.getByText("Publicité")).toHaveCount(0);

  await conversation.getByRole("link").click();
  const thread = page.getByRole("list", { name: "Emails" });
  await expect(thread).toContainText("Merci, c'est parfait !");
  await expect(thread).toContainText("Reçu");
  // Le message cité est replié.
  await expect(thread.getByText("> Voici la maquette.")).toBeHidden();
  await thread.getByText("Afficher le message cité").click();
  await expect(thread.getByText(/> Voici la maquette\./)).toBeVisible();
  const plan = thread.getByRole("link", { name: "plan.pdf" });
  await expect(plan).toBeVisible();
  expect((await page.request.get((await plan.getAttribute("href"))!)).status()).toBe(200);
  // Réponse préparée : « Re: » une seule fois.
  await expect(page.getByLabel("Objet")).toHaveValue(`Re: ${SUBJECT}`);

  // Ouverte : plus de non-lu.
  await expect(async () => {
    await page.goto("/mails");
    await expect(
      page
        .getByRole("list", { name: "Conversations" })
        .getByRole("listitem")
        .filter({ hasText: CLIENT.name })
        .getByLabel(/non lu/),
    ).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
});

test("nouvel email du client : notification pour les applications, fiche client", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  const before = (await (await page.request.get("/api/notifications")).json()) as {
    latest: number;
  };
  await clientWrites({
    from: CLIENT.email,
    subject: "Question sur la facture",
    text: "Bonjour, pouvez-vous me renvoyer la facture ?",
  });
  await syncNow(page, "1 nouvel(s) email(s) de client.");

  const after = (await (
    await page.request.get(`/api/notifications?apres=${before.latest}`)
  ).json()) as { mails: number; notifications: { title: string; body: string }[] };
  expect(after.mails).toBeGreaterThanOrEqual(1);
  expect(after.notifications).toContainEqual(
    expect.objectContaining({ title: `Mail de ${CLIENT.name}`, body: "Question sur la facture" }),
  );

  await page.goto(clientUrl);
  const recent = page.getByRole("list", { name: "Derniers emails" });
  await expect(recent).toContainText("Question sur la facture");
  await expect(recent).toContainText(`Re: ${SUBJECT}`);
  await expect(recent).toContainText(SUBJECT);
});

test("relève des mails : route du conteneur cron protégée par son secret", async ({ request }) => {
  expect((await request.post("/api/taches/courriels")).status()).toBe(401);
});
