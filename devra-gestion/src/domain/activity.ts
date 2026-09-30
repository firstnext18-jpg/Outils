/**
 * Phrases du journal d'activité : « a modifié : adresse, email ».
 * Le nom de la personne et l'objet concerné sont affichés à côté.
 */
export function describeActivity(action: string, details: unknown): string {
  const data = (details ?? {}) as Record<string, unknown>;
  switch (action) {
    case "client.created":
      return "a créé la fiche";
    case "client.updated": {
      const fields = Array.isArray(data.fields) ? (data.fields as string[]) : [];
      return fields.length
        ? `a modifié : ${fields.join(", ")}`
        : "a enregistré la fiche sans changement";
    }
    case "client.archived":
      return "a archivé la fiche";
    case "client.unarchived":
      return "a désarchivé la fiche";
    case "client.deleted":
      return "a supprimé la fiche";
    case "client.data_exported":
      return "a exporté toutes les données du client (nLPD)";
    default:
      return action;
  }
}
