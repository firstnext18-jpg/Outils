import { calendarFeedIcs } from "@/modules/calendar/service";

/**
 * Abonnement iCal aux échéances (Outlook, Google Agenda, téléphone) :
 *   GET /api/calendrier/<jeton>
 * Le jeton (personnel, créé dans la page Calendrier) fait office d'autorisation.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/calendrier/[jeton]">) {
  const { jeton } = await params;
  const ics = await calendarFeedIcs(jeton.replace(/\.ics$/, ""));
  if (!ics) return new Response("Introuvable", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="echeances.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
