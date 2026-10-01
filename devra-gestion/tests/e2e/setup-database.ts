/**
 * Lancé avant le serveur de test : crée la base éphémère, applique les
 * migrations et crée l'administrateur de test (seed).
 */
import { execSync } from "node:child_process";
import { createTestDatabase, testDatabaseUrl } from "./test-database";

async function main() {
  await createTestDatabase();
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl() };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
