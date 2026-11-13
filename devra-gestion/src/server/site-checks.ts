import "server-only";
import { connect } from "node:tls";
import { isUpStatus } from "@/domain/sites";

/**
 * Vérifications des sites des clients depuis le serveur : réponse HTTP,
 * certificat HTTPS, date d'expiration du domaine (registre RDAP).
 * Aucune information de l'entreprise n'est envoyée aux sites vérifiés.
 */
const USER_AGENT = "Mozilla/5.0 (compatible; GestionSurveillance/1.0)";

export type SiteCheck = { up: boolean; status: number | null; ms: number; error: string };

/** Une requête GET (redirections suivies), 15 secondes au plus. */
export async function checkSite(url: string): Promise<SiteCheck> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    // Le contenu n'est pas lu : seule la réponse compte.
    await response.body?.cancel().catch(() => undefined);
    const ms = Date.now() - started;
    const up = isUpStatus(response.status);
    return { up, status: response.status, ms, error: up ? "" : `Réponse HTTP ${response.status}` };
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Pas de réponse en 15 secondes"
        : cause === "ENOTFOUND"
          ? "Nom de domaine introuvable (DNS)"
          : cause === "ECONNREFUSED"
            ? "Connexion refusée"
            : cause?.startsWith("ERR_TLS") || cause === "CERT_HAS_EXPIRED"
              ? "Certificat HTTPS invalide ou expiré"
              : `Inaccessible${cause ? ` (${cause})` : ""}`;
    return { up: false, status: null, ms: Date.now() - started, error: message };
  }
}

/** Date d'expiration du certificat HTTPS du site, ou `null` (pas de HTTPS, injoignable). */
export function certificateExpiry(url: string): Promise<Date | null> {
  return new Promise((resolve) => {
    let host: string;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return resolve(null);
      host = parsed.hostname;
    } catch {
      return resolve(null);
    }
    const socket = connect({
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: false,
      timeout: 10_000,
    });
    const done = (value: Date | null) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("secureConnect", () => {
      const validTo = socket.getPeerCertificate()?.valid_to;
      const date = validTo ? new Date(validTo) : null;
      done(date && !Number.isNaN(date.getTime()) ? date : null);
    });
    socket.once("timeout", () => done(null));
    socket.once("error", () => done(null));
  });
}

/** Annuaire IANA des serveurs RDAP par extension (.com, .ch…), gardé 24 heures. */
let bootstrap: { at: number; services: [string[], string[]][] } | null = null;

async function rdapServer(tld: string): Promise<string | null> {
  if (!bootstrap || Date.now() - bootstrap.at > 24 * 3600_000) {
    const response = await fetch("https://data.iana.org/rdap/dns.json", {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { services: [string[], string[]][] };
    bootstrap = { at: Date.now(), services: data.services };
  }
  const service = bootstrap.services.find(([tlds]) => tlds.includes(tld));
  return service?.[1][0] ?? null;
}

/**
 * Date d'expiration du domaine publiée par son registre (RDAP), ou `null`
 * si le registre ne la publie pas (c'est le cas des .ch et .li) ou ne répond pas.
 */
export async function domainExpiry(domain: string): Promise<Date | null> {
  const tld = domain.split(".").pop()?.toLowerCase();
  if (!tld || !/^[a-z0-9-]+$/.test(tld)) return null;
  try {
    const server = await rdapServer(tld);
    if (!server) return null;
    const response = await fetch(
      `${server.replace(/\/$/, "")}/domain/${encodeURIComponent(domain)}`,
      {
        headers: { Accept: "application/rdap+json" },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      events?: { eventAction?: string; eventDate?: string }[];
    };
    const expiration = data.events?.find((e) => e.eventAction === "expiration")?.eventDate;
    const date = expiration ? new Date(expiration) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}
