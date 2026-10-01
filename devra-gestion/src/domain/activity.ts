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
    case "invoice.created":
      if (typeof data.fromSubscription === "string") {
        return `a généré la facture de l'abonnement « ${data.fromSubscription} »`;
      }
      return typeof data.fromQuote === "string"
        ? `a créé la facture à partir du devis ${data.fromQuote}`
        : "a créé la facture";
    case "invoice.duplicated":
      return typeof data.from === "string"
        ? `a créé cette facture en dupliquant ${data.from}`
        : "a dupliqué la facture";
    case "invoice.updated":
      return "a modifié la facture";
    case "invoice.deleted":
      return "a supprimé le brouillon de facture";
    case "invoice.issued":
      return "a émis la facture (numéro attribué, facture verrouillée)";
    case "invoice.cancelled":
      return typeof data.reason === "string"
        ? `a annulé la facture : ${data.reason}`
        : "a annulé la facture";
    case "payment.recorded":
      return `a enregistré un paiement de ${String(data.amount ?? "")}${
        typeof data.method === "string" ? ` (${data.method})` : ""
      }`;
    case "payment.deleted":
      return `a supprimé un paiement de ${String(data.amount ?? "")}`;
    case "quote.emailed":
    case "invoice.emailed": {
      const to = Array.isArray(data.to) ? (data.to as string[]).join(", ") : "";
      const what = action === "quote.emailed" ? "le devis" : "la facture";
      return to ? `a envoyé ${what} par email à ${to}` : `a envoyé ${what} par email`;
    }
    case "invoice.reminded":
      return `a ${data.channel === "EMAIL" ? "envoyé par email" : "enregistré"} : ${String(
        data.label ?? "relance",
      ).toLowerCase()} (${String(data.amount ?? "")})`;
    case "subscription.created":
      return typeof data.fromQuote === "string"
        ? `a créé l'abonnement à partir du devis ${data.fromQuote}`
        : "a créé l'abonnement";
    case "subscription.updated":
      return "a modifié l'abonnement";
    case "subscription.paused":
      return "a mis l'abonnement en pause";
    case "subscription.resumed":
      return "a repris l'abonnement";
    case "subscription.cancelled":
      return "a résilié l'abonnement";
    case "subscription.deleted":
      return "a supprimé l'abonnement";
    case "subscription.invoiced":
      return `a généré la facture de la période ${String(data.period ?? "")}`;
    case "quote.status_changed":
      return QUOTE_STATUS_SENTENCES[String(data.to)] ?? "a changé le statut du devis";
    default:
      return action;
  }
}
