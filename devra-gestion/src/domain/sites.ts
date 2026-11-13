/**
 * Sites des clients : adresse surveillée, nom de domaine, disponibilité.
 * Module pur : utilisable côté serveur comme côté client.
 */

/** Adresse saisie → URL complète (https:// ajouté si besoin), ou `null` si invalide. */
export function normalizeSiteUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Nom de domaine enregistré d'une adresse : www. retiré, deux derniers niveaux
 * (« shop.atelier.ch » → « atelier.ch »), trois pour les suffixes comme co.uk.
 */
export function domainFromUrl(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
  const parts = host.replace(/^www\./, "").split(".");
  const secondLevel = ["co", "com", "net", "org", "gov", "ac"];
  const keep = parts.length > 2 && secondLevel.includes(parts.at(-2)!) ? 3 : 2;
  return parts.slice(-keep).join(".");
}

/** Le site répond-il correctement ? Les pages protégées (401, 403) comptent comme en ligne. */
export function isUpStatus(status: number): boolean {
  return (status >= 200 && status < 400) || status === 401 || status === 403;
}

/** Échecs consécutifs avant d'alerter (évite les fausses alertes d'une seule coupure). */
export const FAILURES_BEFORE_ALERT = 2;

/**
 * Disponibilité sur la période, en pour cent (une décimale) : temps hors
 * incidents. Un incident en cours compte jusqu'à `to`.
 */
export function uptimePercent(
  incidents: { startedAt: Date; endedAt: Date | null }[],
  from: Date,
  to: Date,
): number {
  const total = to.getTime() - from.getTime();
  if (total <= 0) return 100;
  let down = 0;
  for (const incident of incidents) {
    const start = Math.max(incident.startedAt.getTime(), from.getTime());
    const end = Math.min((incident.endedAt ?? to).getTime(), to.getTime());
    if (end > start) down += end - start;
  }
  return Math.round(((total - down) / total) * 1000) / 10;
}

/** Nombre de jours entre aujourd'hui et une date (négatif si dépassée). */
export function daysUntil(date: string, today: string): number {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
}

export type Renewal = {
  kind: "domain" | "hosting" | "ssl";
  label: string;
  date: string;
  days: number;
};

export const RENEWAL_LABELS: Record<Renewal["kind"], string> = {
  domain: "Domaine",
  hosting: "Hébergement",
  ssl: "Certificat HTTPS",
};

/** Échéances connues d'un site (domaine, hébergement, certificat), la plus proche d'abord. */
export function siteRenewals(
  site: {
    domainExpiresAt: string | null;
    hostingRenewsAt: string | null;
    sslExpiresAt: string | null;
  },
  today: string,
): Renewal[] {
  const items: Renewal[] = [];
  const add = (kind: Renewal["kind"], date: string | null) => {
    if (date) items.push({ kind, label: RENEWAL_LABELS[kind], date, days: daysUntil(date, today) });
  };
  add("domain", site.domainExpiresAt);
  add("hosting", site.hostingRenewsAt);
  add("ssl", site.sslExpiresAt);
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
