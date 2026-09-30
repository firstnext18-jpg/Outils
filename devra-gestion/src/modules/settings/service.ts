import { db, type Tx } from "@/server/db";

const SETTINGS_ID = 1;

/**
 * Paramètres de l'application (ligne unique). La ligne est créée par le seed ;
 * on la crée à la volée si elle manque, pour ne jamais planter.
 */
export async function getSettings(client: Tx | typeof db = db) {
  return client.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export type AppSettings = Awaited<ReturnType<typeof getSettings>>;

/** Nom affiché de l'entreprise, ou un libellé neutre tant qu'il n'est pas renseigné. */
export function displayCompanyName(settings: Pick<AppSettings, "companyName">): string {
  return settings.companyName.trim() || "Gestion";
}
