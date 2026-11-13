import { runMonitoring } from "@/modules/sites/service";
import { cronUnauthorized } from "@/server/cron-auth";

/** Une seule vérification à la fois (un passage lent ne se superpose pas au suivant). */
let running = false;

/**
 * Surveillance des sites, appelée par le conteneur « cron » toutes les
 * MONITOR_MINUTES minutes :
 *   POST /api/taches/surveillance   Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  const refused = cronUnauthorized(request);
  if (refused) return refused;
  if (running) return Response.json({ error: "Vérification déjà en cours" }, { status: 409 });
  running = true;
  try {
    return Response.json(await runMonitoring());
  } finally {
    running = false;
  }
}
