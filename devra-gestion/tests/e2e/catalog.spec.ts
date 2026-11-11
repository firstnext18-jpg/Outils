import { expect, test, type Page } from "@playwright/test";
import { acceptInvitation, ADMIN, invite, login, logout } from "./fixtures";

test.describe.configure({ mode: "serial" });

const READER = {
  name: "Carla Lecture",
  email: "carla@e2e-catalog.test",
  password: "Carla-Password-2026",
};

function row(page: Page, name: string) {
  return page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
}

async function openActions(page: Page, name: string) {
  await page.getByRole("button", { name: `Actions pour ${name}`, exact: true }).click();
}

test("le catalogue contient des exemples modifiables", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/catalogue");
  await expect(row(page, "Site vitrine (jusqu'à 5 pages)")).toContainText("CHF 1'490.00");
  await expect(row(page, "Hébergement + maintenance")).toContainText("CHF 29.00 / mois");
  await expect(row(page, "Modification sur demande")).toContainText("CHF 90.00 / h");
  await expect(page.getByRole("heading", { name: "Abonnements" })).toBeVisible();
});

test("création d'une prestation à l'heure, avec validation du prix", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/catalogue");
  await page.getByRole("button", { name: "Nouvelle prestation" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Heure" }).click();
  await dialog.getByLabel("Nom", { exact: true }).fill("Formation WordPress");
  await dialog.getByLabel("Prix unitaire").fill("cent vingt");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog.getByText("Montant invalide (ex. 1'490.00)")).toBeVisible();

  await dialog.getByLabel("Prix unitaire").fill("120");
  await dialog.getByLabel("Catégorie").fill("Prestations à l'heure");
  await dialog.getByText("Version allemande (facultatif)").click();
  await dialog.getByLabel("Nom en allemand").fill("WordPress-Schulung");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("« Formation WordPress » ajoutée au catalogue.")).toBeVisible();
  await expect(row(page, "Formation WordPress")).toContainText("CHF 120.00 / h");
  await expect(row(page, "Formation WordPress")).toContainText("DE · WordPress-Schulung");
});

test("abonnement trimestriel : périodicité et unité", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/catalogue");
  await page.getByRole("button", { name: "Nouvelle prestation" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Abonnement" }).click();
  await dialog.getByRole("combobox", { name: "Périodicité" }).click();
  await page.getByRole("option", { name: "Trimestriel" }).click();
  await expect(dialog.getByRole("combobox", { name: "Unité" })).toHaveText("Trimestre");
  await dialog.getByLabel("Nom", { exact: true }).fill("Référencement suivi");
  await dialog.getByLabel("Prix unitaire").fill("1'200.50");
  await dialog.getByLabel("Catégorie").fill("Abonnements");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row(page, "Référencement suivi")).toContainText("CHF 1'200.50 / trimestre");
  await expect(row(page, "Référencement suivi")).toContainText("Abonnement · trimestriel");
});

test("modification et duplication", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/catalogue");
  await openActions(page, "Formation WordPress");
  await page.getByRole("menuitem", { name: "Modifier" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Prix unitaire")).toHaveValue("120.00");
  await dialog.getByLabel("Prix unitaire").fill("135");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Prestation enregistrée.")).toBeVisible();
  await expect(row(page, "Formation WordPress")).toContainText("CHF 135.00 / h");

  await openActions(page, "Formation WordPress");
  await page.getByRole("menuitem", { name: "Dupliquer" }).click();
  await expect(page.getByRole("dialog").getByLabel("Nom", { exact: true })).toHaveValue(
    "Formation WordPress (copie)",
  );
  await page
    .getByRole("dialog")
    .getByLabel("Nom", { exact: true })
    .fill("Formation WordPress avancée");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await expect(row(page, "Formation WordPress avancée")).toContainText("CHF 135.00 / h");
});

test("recherche (y compris sur le nom allemand) et filtres", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/catalogue");
  await page.getByLabel("Rechercher une prestation").fill("wartung");
  await expect(page).toHaveURL(/q=wartung/);
  await expect(row(page, "Hébergement + maintenance")).toBeVisible();
  await expect(row(page, "Landing page")).toHaveCount(0);

  await page.goto("/catalogue?type=supplement");
  await expect(row(page, "Page supplémentaire")).toBeVisible();
  await expect(row(page, "Landing page")).toHaveCount(0);
});

test("désactivation, puis suppression", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/catalogue");
  await openActions(page, "Formation WordPress avancée");
  await page.getByRole("menuitem", { name: "Désactiver" }).click();
  await expect(page.getByText("Prestation désactivée.")).toBeVisible();
  await expect(row(page, "Formation WordPress avancée")).toHaveCount(0);

  await page.goto("/catalogue?statut=inactives");
  await expect(row(page, "Formation WordPress avancée")).toContainText("Désactivée");
  await openActions(page, "Formation WordPress avancée");
  await page.getByRole("menuitem", { name: "Supprimer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("« Formation WordPress avancée » supprimée.")).toBeVisible();
  await expect(row(page, "Formation WordPress avancée")).toHaveCount(0);
});

test("lecture seule : consulte le catalogue sans pouvoir le modifier", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await invite(page, READER, "Lecture seule");
  await logout(page);
  await acceptInvitation(page, READER);
  await page.goto("/catalogue");
  await expect(row(page, "Landing page")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nouvelle prestation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Actions pour/ })).toHaveCount(0);
});

test("tarifs publics : /tarif.php sans connexion, prestations actives seulement", async ({
  page,
  request,
}) => {
  type PriceList = {
    devise: string;
    tva: { assujettie: boolean };
    categories: {
      categorie: string | null;
      prestations: { nom: string; nomDe: string; prix: number; prixTexte: string }[];
    }[];
  };
  const prices = async () => {
    const response = await request.get("/tarif.php");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers()["access-control-allow-origin"]).toBe("*");
    const list = (await response.json()) as PriceList;
    return list.categories.flatMap((c) =>
      c.prestations.map((p) => ({ ...p, categorie: c.categorie })),
    );
  };

  const published = await prices();
  expect(published.find((p) => p.nom === "Formation WordPress")).toMatchObject({
    categorie: "Prestations à l'heure",
    nomDe: "WordPress-Schulung",
    // Prix modifié par le test « modification et duplication ».
    prix: 135,
    prixTexte: "CHF 135.00 / h",
  });
  // Supprimée plus haut : absente.
  expect(published.find((p) => p.nom === "Formation WordPress avancée")).toBeUndefined();

  // Désactivée : retirée de la liste publique.
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/catalogue");
  await openActions(page, "Formation WordPress");
  await page.getByRole("menuitem", { name: "Désactiver" }).click();
  await expect(page.getByText("Prestation désactivée.")).toBeVisible();
  expect((await prices()).find((p) => p.nom === "Formation WordPress")).toBeUndefined();
});
