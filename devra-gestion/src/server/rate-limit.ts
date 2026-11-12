import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { env } from "@/server/env";

export type RateRule = { windowSeconds: number; max: number };

/**
 * Limitation des tentatives (protection contre la force brute) pour ce que
 * Better Auth ne couvre pas : la connexion à l'espace client, notamment.
 * Fenêtre fixe, compteurs en base (table rate_limit, clés préfixées) : ils
 * restent valables après un redémarrage. Renvoie `false` au-delà de `max`
 * tentatives dans la fenêtre.
 */
export async function allowAttempt(key: string, rule: RateRule): Promise<boolean> {
  if (!env().AUTH_RATE_LIMIT) return true;
  const now = BigInt(Date.now());
  const windowStart = now - BigInt(rule.windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit (id, key, count, "lastRequest")
    VALUES (${randomUUID()}, ${key}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit."lastRequest" <= ${windowStart} THEN 1 ELSE rate_limit.count + 1 END,
      "lastRequest" = CASE WHEN rate_limit."lastRequest" <= ${windowStart} THEN ${now} ELSE rate_limit."lastRequest" END
    RETURNING count`;
  return (rows[0]?.count ?? 1) <= rule.max;
}
