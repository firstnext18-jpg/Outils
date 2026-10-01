import { timingSafeEqual } from "node:crypto";
import { runDailyTasks } from "@/modules/tasks/service";
import { UserError } from "@/server/action";
import { env } from "@/server/env";

/**
 * Tâches quotidiennes, appelées par le conteneur « cron » :
 *   POST /api/taches/quotidiennes   Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(secret);
  const received = Buffer.from(given);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const result = await runDailyTasks("cron");
    return Response.json(result, { status: result.errors.length > 0 ? 500 : 200 });
  } catch (error) {
    if (error instanceof UserError) return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
