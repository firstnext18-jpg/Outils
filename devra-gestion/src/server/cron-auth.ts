import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";

/**
 * Vérifie le secret du conteneur « cron » (Authorization: Bearer <CRON_SECRET>).
 * Renvoie la réponse d'erreur à retourner, ou `null` si l'appel est autorisé.
 */
export function cronUnauthorized(request: Request): Response | null {
  const secret = env().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(secret);
  const received = Buffer.from(given);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  return null;
}
