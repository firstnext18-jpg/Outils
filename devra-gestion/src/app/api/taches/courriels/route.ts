import { syncMailbox } from "@/modules/mails/service";
import { cronUnauthorized } from "@/server/cron-auth";

/**
 * Relève de la boîte mail (section Mail), appelée par le conteneur « cron »
 * toutes les MAIL_MINUTES minutes :
 *   POST /api/taches/courriels   Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  const refused = cronUnauthorized(request);
  if (refused) return refused;
  const result = await syncMailbox();
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
