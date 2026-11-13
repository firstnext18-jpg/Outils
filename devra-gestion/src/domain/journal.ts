/**
 * Journal d'activité : phrases complètes, avec l'objet concerné
 * (« a envoyé le devis D-2026-004 par email à … »), et catégories de filtre.
 * L'historique affiché sur chaque document utilise `describeActivity`, plus
 * court (l'objet y est implicite).
 */
import { describeActivity } from "@/domain/activity";
import { ROLE_LABELS, type Role } from "@/domain/roles";

export type JournalEntry = {
  action: string;
  label: string | null;
  details: unknown;
};

export const JOURNAL_CATEGORIES = {
  clients: { label: "Clients et fichiers", prefixes: ["client.", "clients.", "file."] },
  devis: { label: "Devis", prefixes: ["quote."] },
  factures: { label: "Factures et paiements", prefixes: ["invoice.", "payment."] },
  abonnements: { label: "Abonnements", prefixes: ["subscription."] },
  catalogue: { label: "Catalogue", prefixes: ["catalog."] },
  utilisateurs: { label: "Utilisateurs", prefixes: ["user."] },
  parametres: { label: "Paramètres", prefixes: ["settings."] },
  exports: { label: "Exports", prefixes: ["export."] },
  discussions: { label: "Discussions", prefixes: ["discussion."] },
  "espace-client": { label: "Espace client", prefixes: ["portal."] },
  projets: { label: "Projets et temps", prefixes: ["project.", "time."] },
  depenses: { label: "Dépenses", prefixes: ["expense."] },
  sites: { label: "Sites", prefixes: ["site."] },
  associes: { label: "Apports des associés", prefixes: ["partner."] },
} as const;

export type JournalCategory = keyof typeof JOURNAL_CATEGORIES;

const QUOTE_STATUS: Record<string, (label: string) => string> = {
  DRAFT: (l) => `a repassé le devis ${l} en brouillon`,
  SENT: (l) => `a marqué le devis ${l} comme envoyé`,
  ACCEPTED: (l) => `a marqué le devis ${l} comme accepté`,
  REFUSED: (l) => `a marqué le devis ${l} comme refusé`,
  EXPIRED: (l) => `a constaté l'expiration du devis ${l}`,
};

const SITE_TYPE_OPERATIONS: Record<string, string> = {
  created: "a ajouté le type de site",
  renamed: "a renommé le type de site",
  moved: "a déplacé le type de site",
  activated: "a réactivé le type de site",
  deactivated: "a désactivé le type de site",
  deleted: "a supprimé le type de site",
};

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function list(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(", ") : "";
}

/** Phrase du journal, sans le nom de la personne (affiché à côté). */
export function journalSentence(entry: JournalEntry): string {
  const data = (entry.details ?? {}) as Record<string, unknown>;
  const label = entry.label ?? "";
  const quoted = `« ${label} »`;
  switch (entry.action) {
    // Clients
    case "client.created":
      return `a créé la fiche client ${quoted}`;
    case "client.updated": {
      const fields = list(data.fields);
      return fields
        ? `a modifié la fiche client ${quoted} : ${fields}`
        : `a enregistré la fiche client ${quoted} sans changement`;
    }
    case "file.uploaded":
    case "file.deleted":
    case "file.visibility_changed":
    case "site.created":
    case "site.updated":
    case "site.deleted":
      return `${describeActivity(entry.action, entry.details)} (${label})`;
    case "client.stage_changed":
      return data.to
        ? `a passé ${label} à l'état « ${text(data.to)} »`
        : `a retiré l'état de ${label}`;
    case "client.archived":
      return `a archivé la fiche client ${quoted}`;
    case "client.unarchived":
      return `a désarchivé la fiche client ${quoted}`;
    case "client.deleted":
      return `a supprimé la fiche client ${quoted}`;
    case "client.data_exported":
      return `a exporté toutes les données du client ${quoted} (nLPD)`;
    case "clients.imported":
      return `a importé ${text(data.created)} client(s) depuis le fichier ${quoted}`;
    case "clients.exported":
      return `a exporté la liste des clients (${text(data.count)}, ${text(data.format).toUpperCase()})`;

    // Catalogue
    case "catalog.created":
      return `a créé la prestation ${quoted}`;
    case "catalog.updated":
      return `a modifié la prestation ${quoted}`;
    case "catalog.activated":
      return `a réactivé la prestation ${quoted}`;
    case "catalog.deactivated":
      return `a désactivé la prestation ${quoted}`;
    case "catalog.deleted":
      return `a supprimé la prestation ${quoted}`;

    // Devis
    case "quote.created":
      return `a créé le devis ${label}`;
    case "quote.duplicated":
      return data.from
        ? `a créé le devis ${label} en dupliquant ${text(data.from)}`
        : `a créé le devis ${label}`;
    case "quote.updated":
      return `a modifié le devis ${label}`;
    case "quote.deleted":
      return `a supprimé le devis ${label}`;
    case "quote.status_changed":
      return (QUOTE_STATUS[text(data.to)] ?? ((l: string) => `a changé le statut du devis ${l}`))(
        label,
      );
    case "quote.emailed": {
      const to = list(data.to);
      return to
        ? `a envoyé le devis ${label} par email à ${to}`
        : `a envoyé le devis ${label} par email`;
    }
    case "quote.reminded": {
      const to = list(data.to);
      return data.automatic
        ? `a relancé automatiquement le client pour le devis ${label}${to ? ` (${to})` : ""}`
        : `a relancé le client pour le devis ${label}${to ? ` (${to})` : ""}`;
    }
    case "quote.accepted_online":
      return `a accepté le devis ${label} ${data.portal ? "depuis son espace client" : "en ligne"}`;
    case "quote.refused_online":
      return `a refusé le devis ${label} ${data.portal ? "depuis son espace client" : "en ligne"}`;

    // Espace client
    case "portal.access_created":
      return `a créé l'accès à l'espace client de ${label} (identifiant ${text(data.login)})`;
    case "portal.password_regenerated":
      return `a généré un nouveau mot de passe pour l'espace client de ${label}`;
    case "portal.access_disabled":
      return `a désactivé l'accès à l'espace client de ${label}`;
    case "portal.access_enabled":
      return `a réactivé l'accès à l'espace client de ${label}`;
    case "portal.credentials_emailed":
      return `a envoyé les identifiants de l'espace client de ${label} par email à ${text(data.to)}`;
    case "portal.password_changed":
      return "a changé son mot de passe de l'espace client";
    case "portal.password_reset":
      return "a choisi un nouveau mot de passe pour son espace client (mot de passe oublié)";

    // Factures et paiements
    case "invoice.created":
      if (data.fromSubscription) {
        return `a généré une facture de l'abonnement « ${text(data.fromSubscription)} »`;
      }
      return data.fromQuote
        ? `a créé une facture à partir du devis ${text(data.fromQuote)}`
        : "a créé un brouillon de facture";
    case "invoice.duplicated":
      return `a dupliqué la facture ${text(data.from)}`;
    case "invoice.updated":
      return `a modifié ${label === "Brouillon de facture" ? "un brouillon de facture" : `la facture ${label}`}`;
    case "invoice.deleted":
      return "a supprimé un brouillon de facture";
    case "invoice.issued":
      return `a émis la facture ${label}`;
    case "invoice.cancelled":
      return data.reason
        ? `a annulé la facture ${label} : ${text(data.reason)}`
        : `a annulé la facture ${label}`;
    case "invoice.emailed": {
      const to = list(data.to);
      return to
        ? `a envoyé la facture ${label} par email à ${to}`
        : `a envoyé la facture ${label} par email`;
    }
    case "invoice.reminded":
      return `${data.channel === "EMAIL" ? "a envoyé par email" : "a enregistré"} : ${text(
        data.label,
      ).toLowerCase()} de la facture ${label} (${text(data.amount)})`;
    case "payment.recorded":
      return `a enregistré un paiement de ${text(data.amount)}${
        data.method ? ` (${text(data.method)})` : ""
      } sur la facture ${label}`;
    case "payment.deleted":
      return `a supprimé un paiement de ${text(data.amount)} sur la facture ${label}`;

    // Discussions
    case "discussion.created":
      return data.client
        ? `a démarré la discussion ${quoted} sur le client « ${text(data.client)} »`
        : `a démarré la discussion ${quoted}`;

    // Abonnements
    case "subscription.created":
      return data.fromQuote
        ? `a créé l'abonnement ${quoted} à partir du devis ${text(data.fromQuote)}`
        : `a créé l'abonnement ${quoted}`;
    case "subscription.updated":
      return `a modifié l'abonnement ${quoted}`;
    case "subscription.paused":
      return `a mis l'abonnement ${quoted} en pause`;
    case "subscription.resumed":
      return `a repris l'abonnement ${quoted}`;
    case "subscription.cancelled":
      return `a résilié l'abonnement ${quoted}`;
    case "subscription.deleted":
      return `a supprimé l'abonnement ${quoted}`;
    case "subscription.invoiced":
      return `a généré la facture de l'abonnement ${quoted} (période ${text(data.period)})`;

    // Utilisateurs
    case "user.invited":
      return `a invité ${label}${
        data.role ? ` (${ROLE_LABELS[data.role as Role] ?? text(data.role)})` : ""
      }`;
    case "user.invitation_resent":
      return `a renvoyé l'invitation de ${label}`;
    case "user.invitation_revoked":
      return `a annulé l'invitation de ${label}`;
    case "user.invitation_accepted":
      return "a activé son compte";
    case "user.role_changed":
      return `a changé le rôle de ${label} : ${text(data.fromLabel)} → ${text(data.toLabel)}`;
    case "user.deactivated":
      return `a désactivé le compte de ${label}`;
    case "user.reactivated":
      return `a réactivé le compte de ${label}`;

    // Paramètres
    case "settings.company_updated":
      return "a modifié les informations de l'entreprise";
    case "settings.logo_updated":
      return "a changé le logo";
    case "settings.logo_removed":
      return "a supprimé le logo";
    case "settings.site_types_updated":
      return `${SITE_TYPE_OPERATIONS[text(data.operation)] ?? "a modifié le type de site"} ${quoted}`;
    case "expense.created":
      return `a enregistré la dépense ${quoted} (${text(data.amount)})`;
    case "expense.updated":
      return `a modifié la dépense ${quoted} (${text(data.amount)})`;
    case "expense.deleted":
      return `a supprimé la dépense ${quoted} (${text(data.amount)})`;
    case "partner.created":
      return `a enregistré ${label} (${text(data.amount)})`;
    case "partner.updated":
      return `a modifié ${label} (${text(data.amount)})`;
    case "partner.deleted":
      return `a supprimé ${label} (${text(data.amount)})`;
    case "project.created":
      return `a créé le projet ${quoted}`;
    case "project.updated":
      return `a modifié le projet ${quoted}`;
    case "project.deleted":
      return `a supprimé le projet ${quoted}`;
    case "project.status_changed": {
      const status: Record<string, string> = {
        ACTIVE: "a repris le projet",
        PAUSED: "a mis en pause le projet",
        DONE: "a terminé le projet",
      };
      return `${status[text(data.status)] ?? "a changé le statut du projet"} ${quoted}`;
    }
    case "project.step_done":
      return `a terminé l'étape « ${text(data.step)} » du projet ${quoted}`;
    case "time.invoiced":
      return `a facturé ${text(data.hours)} de ${label} (${text(data.entries)} saisie(s))`;
    case "settings.lists_updated": {
      const operation: Record<string, string> = {
        created: "a ajouté",
        renamed: "a renommé",
        moved: "a déplacé",
        activated: "a réactivé",
        deactivated: "a désactivé",
        deleted: "a supprimé",
      };
      return `${operation[text(data.operation)] ?? "a modifié"} ${quoted} (${text(data.list)})`;
    }
    case "settings.projects_sites_updated":
      return "a modifié les paramètres des projets et des sites";
    case "settings.documents_updated":
      return "a modifié les textes des documents";
    case "settings.emails_updated":
      return "a modifié les modèles d'emails";
    case "settings.reminders_updated":
      return "a modifié les paramètres des relances";
    case "settings.billing_updated":
      return "a modifié les paramètres de facturation";

    // Exports
    case "export.accounting":
      return `a exporté la comptabilité (${text(data.dataset)}, ${text(data.format).toUpperCase()}) ${text(data.period)}`;
    case "export.pdfs":
      return `a téléchargé les PDF ${text(data.period)} (${text(data.count)} fichier(s))`;

    default:
      return describeActivity(entry.action, entry.details);
  }
}

/** Lien vers l'objet concerné, s'il a une page. */
export function journalHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "client":
      return `/clients/${entityId}`;
    case "quote":
      return `/devis/${entityId}`;
    case "invoice":
      return `/factures/${entityId}`;
    case "subscription":
      return `/abonnements/${entityId}`;
    case "discussion":
      return `/discussions/${entityId}`;
    case "project":
      return `/projets/${entityId}`;
    case "expense":
      return `/depenses/${entityId}`;
    case "partner_movement":
      return `/apports/${entityId}`;
    default:
      return null;
  }
}
