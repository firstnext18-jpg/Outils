import { runDailyTasks } from "@/modules/tasks/service";
import { UserError } from "@/server/action";
import { cronUnauthorized } from "@/server/cron-auth";

/**
 * Tâches quotidiennes, appelées par le conteneur « cron » :
 *   POST /api/taches/quotidiennes   Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  const refused = cronUnauthorized(request);
  if (refused) return refused;
  try {
    const result = await runDailyTasks("cron");
    return Response.json(result, { status: result.errors.length > 0 ? 500 : 200 });
  } catch (error) {
    if (error instanceof UserError) return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
