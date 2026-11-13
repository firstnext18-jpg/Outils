import "server-only";
import { db } from "@/server/db";

/** Notifications gardées pour l'application de bureau (jours). */
const KEEP_DAYS = 30;

/**
 * Notifications d'un utilisateur après le numéro `after` (les plus anciennes
 * d'abord, 20 au plus), et le dernier numéro connu.
 */
export async function notificationsAfter(userId: string, after: number | null) {
  const latest = await db.notification.findFirst({
    where: { userId },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (after === null) return { latest: latest?.id ?? 0, notifications: [] };
  const notifications = await db.notification.findMany({
    where: { userId, id: { gt: after } },
    orderBy: { id: "asc" },
    take: 20,
    select: { id: true, title: true, body: true, url: true, tag: true, createdAt: true },
  });
  return {
    latest: Math.max(latest?.id ?? 0, notifications.at(-1)?.id ?? 0),
    notifications,
  };
}

/** Supprime les notifications de plus de 30 jours (tâche quotidienne). */
export async function purgeOldNotifications(now = new Date()) {
  const { count } = await db.notification.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } },
  });
  return count;
}
