/**
 * Phrases du journal d'activité : « a modifié : adresse, email ».
 * Le nom de la personne et l'objet concerné sont affichés à côté.
 */
const QUOTE_STATUS_SENTENCES: Record<string, string> = {
  DRAFT: "a repassé le devis en brouillon",
  SENT: "a marqué le devis comme envoyé",
  ACCEPTED: "a marqué le devis comme accepté",
  REFUSED: "a marqué le devis comme refusé",
  EXPIRED: "a constaté l'expiration du devis (date de validité dépassée)",
};

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
    case "quote.created":
      return "a créé le devis";
    case "quote.duplicated":
      return typeof data.from === "string"
        ? `a créé ce devis en dupliquant ${data.from}`
        : "a dupliqué le devis";
    case "quote.updated":
      return "a modifié le devis";
    case "quote.deleted":
      return "a supprimé le devis";
    case "quote.status_changed":
      return QUOTE_STATUS_SENTENCES[String(data.to)] ?? "a changé le statut du devis";
    default:
      return action;
  }
}
