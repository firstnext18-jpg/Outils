import { portalInvoiceForPdf } from "@/modules/portal/service";
import { getSettings } from "@/modules/settings/service";
import { invoicePdfForDownload } from "@/server/pdf/invoice-pdf";
import { getPortalSession } from "@/server/portal-session";

/**
 * PDF d'une facture (avec la QR-facture), depuis l'espace client : seulement
 * les factures émises du client connecté. C'est le PDF archivé à l'émission.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/espace-client/factures/[id]/pdf">,
) {
  const session = await getPortalSession();
  if (!session) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const invoice = await portalInvoiceForPdf(session.client.id, id);
  if (!invoice) return new Response("Introuvable", { status: 404 });

  const { buffer, fileName } = await invoicePdfForDownload(invoice, await getSettings());
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
