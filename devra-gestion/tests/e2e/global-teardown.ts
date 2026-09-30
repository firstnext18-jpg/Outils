import { dropTestDatabase } from "./test-database";

/** Supprime la base éphémère créée pour ce lancement. */
export default async function globalTeardown() {
  await dropTestDatabase();
}
