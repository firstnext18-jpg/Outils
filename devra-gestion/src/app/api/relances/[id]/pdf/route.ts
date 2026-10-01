import { getInvoice } from "@/modules/invoices/service";
import { getSettings } from "@/modules/settings/service";
import { db } from "@/server/db";
import { reminderPdfForDownload } from "@/server/pdf/reminder-pdf";
import { getCurrentUser } from "@/server/session";

/** PDF d'une relance : celui archivé à l'envoi (régénéré à partir du texte enregistré s'il manque). */
export async function GET(request: Request, { params }: RouteContext<"/api/relances/[id]/pdf">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Relance introuvable", { status: 404 });
  const reminder = await db.reminder.findUnique({ where: { id } });
  if (!reminder) return new Response("Relance introuvable", { status: 404 });
  const [invoice, settings] = await Promise.all([getInvoice(reminder.invoiceId), getSettings()]);
  if (!invoice) return new Response("Facture introuvable", { status: 404 });

  const { buffer, fileName } = await reminderPdfForDownload(reminder, invoice, settings);
  const disposition = new URL(request.url).searchParams.has("telecharger")
    ? "attachment"
    : "inline";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
