import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";

/** Codes des actions enregistrées dans le journal d'activité. */
export type ActivityAction =
  | "user.invited"
  | "user.invitation_resent"
  | "user.invitation_revoked"
  | "user.invitation_accepted"
  | "user.role_changed"
  | "user.deactivated"
  | "user.reactivated"
  | "settings.company_updated"
  | "settings.logo_updated"
  | "settings.logo_removed"
  | "settings.site_types_updated"
  | "settings.lists_updated"
  | "settings.projects_sites_updated"
  | "client.created"
  | "client.updated"
  | "client.archived"
  | "client.unarchived"
  | "client.deleted"
  | "client.data_exported"
  | "client.stage_changed"
  | "file.uploaded"
  | "file.deleted"
  | "file.visibility_changed"
  | "project.created"
  | "project.updated"
  | "project.status_changed"
  | "project.deleted"
  | "project.step_done"
  | "time.invoiced"
  | "expense.created"
  | "expense.updated"
  | "expense.deleted"
  | "site.created"
  | "site.updated"
  | "site.deleted"
  | "clients.imported"
  | "clients.exported"
  | "catalog.created"
  | "catalog.updated"
  | "catalog.activated"
  | "catalog.deactivated"
  | "catalog.deleted"
  | "quote.created"
  | "quote.duplicated"
  | "quote.updated"
  | "quote.status_changed"
  | "quote.deleted"
  | "invoice.created"
  | "invoice.duplicated"
  | "invoice.updated"
  | "invoice.deleted"
  | "invoice.issued"
  | "invoice.cancelled"
  | "payment.recorded"
  | "payment.deleted"
  | "settings.documents_updated"
  | "settings.emails_updated"
  | "settings.reminders_updated"
  | "invoice.reminded"
  | "subscription.created"
  | "discussion.created"
  | "subscription.updated"
  | "subscription.paused"
  | "subscription.resumed"
  | "subscription.cancelled"
  | "subscription.deleted"
  | "subscription.invoiced"
  | "quote.emailed"
  | "quote.reminded"
  | "invoice.emailed"
  | "settings.billing_updated"
  | "export.accounting"
  | "export.pdfs"
  | "quote.accepted_online"
  | "quote.refused_online"
  | "portal.access_created"
  | "portal.password_regenerated"
  | "portal.access_disabled"
  | "portal.access_enabled"
  | "portal.credentials_emailed"
  | "portal.password_changed"
  | "portal.password_reset";

export type ActivityEntry = {
  userId: string | null;
  action: ActivityAction;
  entityType?: string;
  entityId?: string;
  label?: string;
  details?: Prisma.InputJsonValue;
};

/** Ajoute une ligne au journal (dans la transaction en cours si fournie). */
export async function logActivity(entry: ActivityEntry, client: Tx | typeof db = db) {
  await client.activityLog.create({ data: entry });
}
