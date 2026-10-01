import type { NextRequest } from "next/server";
import { getInvoice } from "@/modules/invoices/service";
import { getSettings } from "@/modules/settings/service";
import { invoicePdfForDownload } from "@/server/pdf/invoice-pdf";
import { getCurrentUser } from "@/server/session";

/** PDF d'une facture : affiché dans le navigateur, ou téléchargé avec ?telecharger=1. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/factures/[id]/pdf">,
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Facture introuvable", { status: 404 });
  const [invoice, settings] = await Promise.all([getInvoice(id), getSettings()]);
  if (!invoice) return new Response("Facture introuvable", { status: 404 });

  const { buffer, fileName } = await invoicePdfForDownload(invoice, settings);
  const disposition = request.nextUrl.searchParams.has("telecharger") ? "attachment" : "inline";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
