import { quoteForToken } from "@/modules/online-quotes/service";
import { getSettings } from "@/modules/settings/service";
import { buildQuotePdf, quotePdfFileName } from "@/server/pdf/quote-pdf";

/** PDF du devis, depuis la page publique d'acceptation (le jeton du lien fait foi). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/devis-en-ligne/[token]/pdf">,
) {
  const { token } = await params;
  const found = await quoteForToken(token);
  if (!found) return new Response("Lien non valable", { status: 404 });
  const settings = await getSettings();
  const { buffer } = await buildQuotePdf(found.quote, settings);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quotePdfFileName(found.quote, settings)}"`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
