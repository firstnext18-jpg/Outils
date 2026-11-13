/**
 * Calendrier au format iCalendar (RFC 5545), auquel Outlook, Google Agenda ou
 * le calendrier du téléphone s'abonnent : événements « journée entière ».
 */

export type CalendarEvent = {
  /** Identifiant stable (le même événement garde le même UID d'une mise à jour à l'autre). */
  uid: string;
  /** Jour de l'événement (AAAA-MM-JJ). */
  date: string;
  title: string;
  description?: string;
  url?: string;
};

/** Texte iCalendar : antislash, virgules, points-virgules et retours à la ligne échappés. */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Lignes de 75 octets au plus, continuées par une espace (RFC 5545, 3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  for (const char of line) {
    const candidate = current + char;
    if (new TextEncoder().encode(candidate).length > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

function compactDate(date: string): string {
  return date.replace(/-/g, "");
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildIcs(events: CalendarEvent[], options: { name: string; now?: Date }): string {
  const stamp = (options.now ?? new Date())
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gestion//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(options.name)}`,
    "X-WR-TIMEZONE:Europe/Zurich",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(event.date))}`,
      `SUMMARY:${icsText(event.title)}`,
      ...(event.description ? [`DESCRIPTION:${icsText(event.description)}`] : []),
      ...(event.url ? [`URL:${event.url}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
