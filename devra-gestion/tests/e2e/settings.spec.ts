import path from "node:path";
import { expect, test } from "@playwright/test";
import { ADMIN, login } from "./fixtures";

test.use({ extraHTTPHeaders: { "x-forwarded-for": "10.0.4.1" } });

test("l'admin renseigne l'entreprise ; un IBAN invalide est refusé", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/entreprise");

  await page.getByLabel("Nom de l'entreprise").fill("Entreprise Test");
  await page.getByLabel("Rue").fill("Rue du Test");
  await page.getByLabel("Numéro").fill("12");
  await page.getByLabel("NPA").fill("1000");
  await page.getByLabel("Localité").fill("Lausanne");
  await page.getByLabel("IBAN", { exact: true }).fill("CH93 0076 2011 6238 5295 8");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("IBAN suisse invalide")).toBeVisible();

  // Un QR-IBAN saisi dans le champ IBAN classique est signalé.
  await page.getByLabel("IBAN", { exact: true }).fill("CH44 3199 9123 0008 8901 2");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Ceci est un QR-IBAN")).toBeVisible();

  await page.getByLabel("IBAN", { exact: true }).fill("ch9300762011623852957");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Informations de l'entreprise enregistrées.")).toBeVisible();

  // Les valeurs sont conservées et le nom apparaît dans la navigation.
  await page.reload();
  await expect(page.getByLabel("IBAN", { exact: true })).toHaveValue("CH93 0076 2011 6238 5295 7");
  await expect(page.getByText("Entreprise Test").first()).toBeVisible();
});

test("l'admin ajoute puis supprime le logo", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/entreprise");
  await page
    .getByLabel("Fichier du logo")
    .setInputFiles(path.join(__dirname, "assets", "logo.png"));
  await expect(page.getByText("Logo enregistré.")).toBeVisible();
  await expect(page.getByAltText("Logo actuel")).toBeVisible();

  const logo = await page.request.get("/api/logo");
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toBe("image/png");

  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Logo supprimé.")).toBeVisible();
  expect((await page.request.get("/api/logo")).status()).toBe(404);
});

test("un fichier qui n'est pas une image est refusé", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/entreprise");
  await page.getByLabel("Fichier du logo").setInputFiles({
    name: "faux.png",
    mimeType: "image/png",
    buffer: Buffer.from("ceci n'est pas une image"),
  });
  await expect(page.getByText("Format non pris en charge")).toBeVisible();
});
