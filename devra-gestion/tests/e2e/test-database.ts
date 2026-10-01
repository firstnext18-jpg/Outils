import { Client } from "pg";

/**
 * Base de données éphémère pour les tests de bout en bout : une base neuve,
 * au nom unique, est créée à chaque lancement puis supprimée à la fin. Aucune
 * base existante n'est jamais vidée ni modifiée.
 */
const SERVER_URL =
  process.env.E2E_POSTGRES_URL ?? "postgresql://devra:devra@localhost:5432/postgres";

export function testDatabaseName(): string {
  // Fixé une fois dans le processus principal, hérité par les processus de test.
  process.env.E2E_DB_NAME ??= `devra_gestion_e2e_${Date.now()}`;
  return process.env.E2E_DB_NAME;
}

export function testDatabaseUrl(): string {
  const url = new URL(SERVER_URL);
  url.pathname = `/${testDatabaseName()}`;
  return url.toString();
}

async function withServer<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: SERVER_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function assertE2eName(name: string) {
  // Garde-fou : on ne touche qu'aux bases créées par ces tests.
  if (!/^devra_gestion_e2e_\d+$/.test(name)) throw new Error(`Nom de base inattendu : ${name}`);
}

export async function createTestDatabase() {
  const name = testDatabaseName();
  assertE2eName(name);
  await withServer((client) => client.query(`CREATE DATABASE "${name}"`));
}

export async function dropTestDatabase() {
  const name = testDatabaseName();
  assertE2eName(name);
  await withServer((client) => client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
}
