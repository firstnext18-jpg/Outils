import type { NextRequest } from "next/server";
import { unreadMessageCount } from "@/modules/discussions/service";
import { notificationsAfter } from "@/modules/notifications/service";
import { getCurrentUser } from "@/server/session";

/**
 * État des notifications de l'utilisateur connecté, lu toutes les quelques
 * secondes par l'application de bureau et par le menu (pastille des non lus) :
 *   GET /api/notifications            → { unread, latest }
 *   GET /api/notifications?apres=12   → { unread, latest, notifications: [...] }
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Non connecté" }, { status: 401 });
  const raw = request.nextUrl.searchParams.get("apres");
  const after = raw !== null && /^\d{1,10}$/.test(raw) ? Number(raw) : null;
  const [unread, result] = await Promise.all([
    unreadMessageCount(user.id),
    notificationsAfter(user.id, after),
  ]);
  return Response.json(
    { unread, ...result },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
