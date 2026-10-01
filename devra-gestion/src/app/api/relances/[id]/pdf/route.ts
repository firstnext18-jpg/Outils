import { dbDateToIso } from "@/domain/dates";
import type { ReminderLevel } from "@/domain/reminders";
import { getInvoice } from "@/modules/invoices/service";
import { getSettings } from "@/modules/settings/service";
import { db } from "@/server/db";
import { buildReminderPdf, reminderPdfFileName } from "@/server/pdf/reminder-pdf";
import { getCurrentUser } from "@/server/session";
import { readDocumentPdf, saveDocumentPdf } from "@/server/storage";

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
  const level = reminder.level as ReminderLevel;

  let buffer = reminder.pdfFile ? await readDocumentPdf("reminders", id) : null;
  if (!buffer) {
    // Montants de la facture au moment de la relance : frais de cette relance non encore comptés.
    const previous = { ...invoice, feesCents: invoice.feesCents - reminder.feeCents };
    ({ buffer } = await buildReminderPdf(
      {
        invoice: previous,
        level,
        date: dbDateToIso(reminder.date),
        dueDate: dbDateToIso(reminder.dueDate),
        feeCents: reminder.feeCents,
        totalCents: reminder.totalCents,
        text: reminder.text,
      },
      settings,
    ));
    const file = await saveDocumentPdf("reminders", id, buffer).catch(() => null);
    if (file) await db.reminder.update({ where: { id }, data: { pdfFile: file } });
  }
  const disposition = new URL(request.url).searchParams.has("telecharger")
    ? "attachment"
    : "inline";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${reminderPdfFileName(invoice, level, settings)}"`,
      "Cache-Control": "no-store",
    },
  });
}
