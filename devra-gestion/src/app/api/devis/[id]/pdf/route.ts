import type { NextRequest } from "next/server";
import { getQuote } from "@/modules/quotes/service";
import { getSettings } from "@/modules/settings/service";
import { buildQuotePdf } from "@/server/pdf/quote-pdf";
import { getCurrentUser } from "@/server/session";

/** PDF d'un devis : affiché dans le navigateur, ou téléchargé avec ?telecharger=1. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/devis/[id]/pdf">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Devis introuvable", { status: 404 });
  const [quote, settings] = await Promise.all([getQuote(id), getSettings()]);
  if (!quote) return new Response("Devis introuvable", { status: 404 });

  const { buffer, fileName } = await buildQuotePdf(quote, settings);
  const disposition = request.nextUrl.searchParams.has("telecharger") ? "attachment" : "inline";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
