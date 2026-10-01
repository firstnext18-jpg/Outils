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
  | "client.created"
  | "client.updated"
  | "client.archived"
  | "client.unarchived"
  | "client.deleted"
  | "client.data_exported"
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
  | "subscription.updated"
  | "subscription.paused"
  | "subscription.resumed"
  | "subscription.cancelled"
  | "subscription.deleted"
  | "subscription.invoiced"
  | "quote.emailed"
  | "invoice.emailed"
  | "settings.billing_updated"
  | "export.accounting"
  | "export.pdfs"
  | "quote.accepted_online"
  | "quote.refused_online";

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
