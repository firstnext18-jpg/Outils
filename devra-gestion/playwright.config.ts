import { defineConfig, devices } from "@playwright/test";
import { ADMIN, CRON_SECRET } from "./tests/e2e/fixtures";
import { testDatabaseUrl } from "./tests/e2e/test-database";

/**
 * Tests de bout en bout. Chaque lancement utilise une base PostgreSQL neuve
 * (créée puis supprimée automatiquement) et lit les emails dans Mailpit.
 * Prérequis : `npm run db:up` (PostgreSQL + Mailpit) et `npm run build`.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  globalTeardown: "./tests/e2e/global-teardown.ts",
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    locale: "fr-CH",
    timezoneId: "Europe/Zurich",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Permet d'utiliser un Chromium déjà installé (ex. dans un conteneur).
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
      },
    },
  ],
  webServer: {
    // Base de test neuve + administrateur de test, puis démarrage du serveur.
    command: [
      "rm -rf ./data/test",
      "npx tsx tests/e2e/setup-database.ts",
      `npx next start -p ${PORT}`,
    ].join(" && "),
    url: `${BASE_URL}/connexion`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      APP_URL: BASE_URL,
      DATABASE_URL: testDatabaseUrl(),
      DATA_DIR: "./data/test",
      AUTH_RATE_LIMIT: "true",
      AUTH_IP_HEADER: "x-forwarded-for",
      SMTP_HOST: "localhost",
      SMTP_PORT: "1025",
      SMTP_SECURE: "false",
      SMTP_FROM: "Gestion <gestion@example.ch>",
      ADMIN_NAME: ADMIN.name,
      ADMIN_EMAIL: ADMIN.email,
      ADMIN_PASSWORD: ADMIN.password,
      CRON_SECRET,
    },
  },
});
