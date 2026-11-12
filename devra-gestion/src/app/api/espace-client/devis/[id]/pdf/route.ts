import { portalQuote } from "@/modules/online-quotes/service";
import { getSettings } from "@/modules/settings/service";
import { buildQuotePdf } from "@/server/pdf/quote-pdf";
import { getPortalSession } from "@/server/portal-session";

/** PDF d'un devis, depuis l'espace client : seulement les devis du client connecté. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/espace-client/devis/[id]/pdf">,
) {
  const session = await getPortalSession();
  if (!session) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const found = await portalQuote(session.client.id, id);
  if (!found) return new Response("Introuvable", { status: 404 });

  const { buffer, fileName } = await buildQuotePdf(found.quote, await getSettings());
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
