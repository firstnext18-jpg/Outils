import { hasRole } from "@/domain/roles";
import { normalizeKey } from "@/domain/text";
import { exportClientData } from "@/modules/clients/service";
import { getCurrentUser } from "@/server/session";

/**
 * Toutes les données d'un client au format JSON (droit d'accès prévu par la
 * nLPD). L'export est inscrit dans le journal d'activité.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/clients/[id]/donnees">,
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  if (!hasRole(user.role, "MEMBER")) return new Response("Accès refusé", { status: 403 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Client introuvable", { status: 404 });
  const data = await exportClientData(user, id);
  if (!data) return new Response("Client introuvable", { status: 404 });

  const slug = normalizeKey(data.client.displayName).slice(0, 40) || "client";
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="donnees-${slug}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
