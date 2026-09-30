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
  | "catalog.deleted";

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
