import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, dbDateToIso, formatIsoDate, isoToDbDate, todayIso } from "@/domain/dates";
import { daysUntil, FAILURES_BEFORE_ALERT, uptimePercent } from "@/domain/sites";
import { formatDateTime } from "@/lib/format";
import type { SiteData } from "@/modules/sites/schemas";
import { getSettings } from "@/modules/settings/service";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import { emailBranding } from "@/server/emails/branding";
import { renderSimpleEmail } from "@/server/emails/layout";
import { env } from "@/server/env";
import { sendMail } from "@/server/mailer";
import { sendPush } from "@/server/push";
import { certificateExpiry, checkSite, domainExpiry } from "@/server/site-checks";
import type { CurrentUser } from "@/server/session";

/**
 * Sites des clients : renouvellements (domaine, hébergement, certificat) et
 * surveillance (vérification toutes les quelques minutes, alerte à l'équipe
 * quand un site tombe et quand il revient).
 */

const listSelect = {
  id: true,
  name: true,
  url: true,
  domain: true,
  domainExpiresAt: true,
  hostingProvider: true,
  hostingRenewsAt: true,
  monitor: true,
  status: true,
  statusChangedAt: true,
  lastCheckAt: true,
  lastResponseMs: true,
  lastError: true,
  sslExpiresAt: true,
  client: { select: { id: true, displayName: true } },
} satisfies Prisma.SiteSelect;

export type SiteRow = Prisma.SiteGetPayload<{ select: typeof listSelect }>;

export function listSites(filter: { clientId?: string } = {}) {
  return db.site.findMany({
    where: filter.clientId ? { clientId: filter.clientId } : {},
    orderBy: [{ status: "desc" }, { client: { sortName: "asc" } }, { name: "asc" }],
    select: listSelect,
  });
}

export async function getSite(id: string) {
  const site = await db.site.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, displayName: true } },
      incidents: { orderBy: { startedAt: "desc" }, take: 20 },
    },
  });
  if (!site) return null;
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  const recent = await db.siteIncident.findMany({
    where: { siteId: id, OR: [{ endedAt: null }, { endedAt: { gte: from } }] },
    select: { startedAt: true, endedAt: true },
  });
  return { ...site, uptime30: uptimePercent(recent, from, to) };
}

export type SiteDetail = NonNullable<Awaited<ReturnType<typeof getSite>>>;

function columns(data: SiteData) {
  return {
    clientId: data.clientId,
    name: data.name,
    url: data.url,
    domain: data.domain,
    registrar: data.registrar,
    domainExpiresAt: data.domainExpiresAt ? isoToDbDate(data.domainExpiresAt) : null,
    domainExpiryAuto: data.domainExpiryAuto,
    hostingProvider: data.hostingProvider,
    hostingRenewsAt: data.hostingRenewsAt ? isoToDbDate(data.hostingRenewsAt) : null,
    notes: data.notes,
    monitor: data.monitor,
    showStatusToClient: data.showStatusToClient,
  };
}

/** Lecture de l'expiration du domaine et du certificat (quelques secondes au plus). */
async function refreshDates(site: {
  id: string;
  url: string;
  domain: string;
  domainExpiryAuto: boolean;
}) {
  const [domain, ssl] = await Promise.all([
    site.domainExpiryAuto ? domainExpiry(site.domain) : Promise.resolve(null),
    certificateExpiry(site.url),
  ]);
  await db.site.update({
    where: { id: site.id },
    data: {
      ...(domain ? { domainExpiresAt: isoToDbDate(domain.toISOString().slice(0, 10)) } : {}),
      domainCheckedAt: site.domainExpiryAuto ? new Date() : undefined,
      sslExpiresAt: ssl,
    },
  });
  return { domainFound: Boolean(domain) };
}

export async function createSite(actor: CurrentUser, data: SiteData) {
  const client = await db.client.findUnique({
    where: { id: data.clientId },
    select: { displayName: true },
  });
  if (!client) throw new UserError("Ce client n'existe plus.");
  const site = await db.site.create({ data: columns(data) });
  await logActivity({
    userId: actor.id,
    action: "site.created",
    entityType: "client",
    entityId: data.clientId,
    label: client.displayName,
    details: { site: data.name, url: data.url },
  });
  // Premières informations tout de suite (sans faire échouer l'enregistrement).
  await Promise.allSettled([refreshDates(site), monitorSite(site.id)]);
  return site;
}

export async function updateSite(actor: CurrentUser, id: string, data: SiteData) {
  const existing = await db.site.findUnique({ where: { id }, select: { url: true, domain: true } });
  if (!existing) throw new UserError("Ce site n'existe plus.");
  const site = await db.site.update({
    where: { id },
    data: columns(data),
    include: { client: { select: { displayName: true } } },
  });
  await logActivity({
    userId: actor.id,
    action: "site.updated",
    entityType: "client",
    entityId: site.clientId,
    label: site.client.displayName,
    details: { site: data.name },
  });
  if (existing.url !== data.url || existing.domain !== data.domain) {
    await Promise.allSettled([refreshDates(site), monitorSite(site.id)]);
  }
  return site;
}

export async function deleteSite(actor: CurrentUser, id: string) {
  const site = await db.site.findUnique({
    where: { id },
    include: { client: { select: { displayName: true } } },
  });
  if (!site) throw new UserError("Ce site n'existe plus.");
  await db.site.delete({ where: { id } });
  await logActivity({
    userId: actor.id,
    action: "site.deleted",
    entityType: "client",
    entityId: site.clientId,
    label: site.client.displayName,
    details: { site: site.name },
  });
  return site;
}

/** Vérification immédiate (bouton « Vérifier maintenant »). */
export async function checkSiteNow(id: string) {
  const site = await db.site.findUnique({ where: { id } });
  if (!site) throw new UserError("Ce site n'existe plus.");
  await Promise.allSettled([refreshDates(site), monitorSite(site.id, { force: true })]);
}

// ---------------------------------------------------------------------------
// Alertes à l'équipe
// ---------------------------------------------------------------------------

async function alertTeam(alert: { title: string; body: string; url: string; tag: string }) {
  const [users, settings] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { id: true, email: true, role: true } }),
    getSettings(),
  ]);
  await sendPush(
    users.map((u) => u.id),
    alert,
  ).catch((error: unknown) => console.error("Notification de surveillance impossible", error));
  if (!settings.monitorAlertEmail) return;
  const recipients = users.filter((u) => u.role !== "READONLY").map((u) => u.email);
  if (recipients.length === 0) return;
  const { branding, attachments } = await emailBranding(settings);
  const { text, html } = renderSimpleEmail({
    branding,
    title: alert.title,
    greeting: "Bonjour,",
    paragraphs: [alert.body],
    action: { label: "Voir dans l'outil", url: `${env().APP_URL}${alert.url}` },
  });
  await sendMail({ to: recipients, subject: alert.title, text, html, attachments }).catch(
    (error: unknown) => console.error("Email de surveillance impossible", error),
  );
}

// ---------------------------------------------------------------------------
// Surveillance (toutes les quelques minutes)
// ---------------------------------------------------------------------------

/**
 * Vérifie un site et met à jour son état. Il passe « hors ligne » après
 * FAILURES_BEFORE_ALERT échecs consécutifs (alerte), et « en ligne » dès qu'il
 * répond à nouveau (alerte de retour si une panne avait été signalée).
 */
async function monitorSite(id: string, options: { force?: boolean } = {}) {
  const site = await db.site.findUnique({
    where: { id },
    include: { client: { select: { displayName: true } } },
  });
  if (!site || (!site.monitor && !options.force)) return;
  const result = await checkSite(site.url);
  const now = new Date();
  const label = `${site.client.displayName} · ${site.name}`;

  if (result.up) {
    const wasDown = site.status === "DOWN";
    await db.$transaction(async (tx) => {
      await tx.site.update({
        where: { id },
        data: {
          status: "UP",
          failures: 0,
          lastCheckAt: now,
          lastResponseMs: result.ms,
          lastError: "",
          ...(site.status !== "UP" ? { statusChangedAt: now } : {}),
        },
      });
      if (wasDown) {
        await tx.siteIncident.updateMany({
          where: { siteId: id, endedAt: null },
          data: { endedAt: now },
        });
      }
    });
    if (wasDown) {
      await alertTeam({
        title: `Site de nouveau en ligne · ${label}`,
        body: `${site.url} répond à nouveau (${formatDateTime(now)}), après une panne depuis le ${
          site.statusChangedAt ? formatDateTime(site.statusChangedAt) : "—"
        }.`,
        url: `/sites/${id}`,
        tag: `site-${id}`,
      });
    }
    return;
  }

  const failures = site.failures + 1;
  const goesDown = site.status !== "DOWN" && failures >= FAILURES_BEFORE_ALERT;
  await db.$transaction(async (tx) => {
    await tx.site.update({
      where: { id },
      data: {
        failures,
        lastCheckAt: now,
        lastResponseMs: null,
        lastError: result.error,
        ...(goesDown ? { status: "DOWN", statusChangedAt: now } : {}),
      },
    });
    if (goesDown)
      await tx.siteIncident.create({ data: { siteId: id, startedAt: now, error: result.error } });
  });
  if (goesDown) {
    await alertTeam({
      title: `Site hors ligne · ${label}`,
      body: `${site.url} ne répond pas correctement : ${result.error}. Vérifié le ${formatDateTime(now)}.`,
      url: `/sites/${id}`,
      tag: `site-${id}`,
    });
  }
}

/** Tous les sites surveillés (appelé par le conteneur « cron »), quelques-uns à la fois. */
export async function runMonitoring() {
  const sites = await db.site.findMany({ where: { monitor: true }, select: { id: true } });
  for (let i = 0; i < sites.length; i += 5) {
    await Promise.allSettled(sites.slice(i, i + 5).map((s) => monitorSite(s.id)));
  }
  return { checked: sites.length };
}

// ---------------------------------------------------------------------------
// Tâche quotidienne : dates d'expiration et rappels de renouvellement
// ---------------------------------------------------------------------------

/**
 * Relit l'expiration des domaines (RDAP) et des certificats, puis rappelle à
 * l'équipe les renouvellements proches (un rappel par échéance).
 */
export async function runDailySiteChecks(today = todayIso()) {
  const settings = await getSettings();
  const sites = await db.site.findMany({ include: { client: { select: { displayName: true } } } });
  for (const site of sites) await refreshDates(site).catch(() => undefined);

  const limit = addDays(today, settings.renewalReminderDays);
  const fresh = await db.site.findMany({ include: { client: { select: { displayName: true } } } });
  let reminders = 0;
  for (const site of fresh) {
    const items: {
      what: string;
      date: string;
      field: "domainReminderFor" | "hostingReminderFor" | "sslReminderFor";
    }[] = [];
    const domain = site.domainExpiresAt ? dbDateToIso(site.domainExpiresAt) : null;
    const hosting = site.hostingRenewsAt ? dbDateToIso(site.hostingRenewsAt) : null;
    const ssl = site.sslExpiresAt ? site.sslExpiresAt.toISOString().slice(0, 10) : null;
    const sameDay = (a: Date | null, b: string) => a !== null && a.toISOString().slice(0, 10) === b;
    if (domain && domain <= limit && !sameDay(site.domainReminderFor, domain))
      items.push({ what: `le domaine ${site.domain}`, date: domain, field: "domainReminderFor" });
    if (hosting && hosting <= limit && !sameDay(site.hostingReminderFor, hosting))
      items.push({
        what: `l'hébergement${site.hostingProvider ? ` (${site.hostingProvider})` : ""}`,
        date: hosting,
        field: "hostingReminderFor",
      });
    // Certificat : 14 jours suffisent (il se renouvelle souvent tout seul).
    if (ssl && ssl <= addDays(today, 14) && !sameDay(site.sslReminderFor, ssl))
      items.push({ what: "le certificat HTTPS", date: ssl, field: "sslReminderFor" });
    for (const item of items) {
      const days = daysUntil(item.date, today);
      await alertTeam({
        title: `Renouvellement · ${site.client.displayName} · ${site.name}`,
        body: `${item.what.charAt(0).toUpperCase()}${item.what.slice(1)} ${
          days < 0 ? "a expiré" : "expire"
        } le ${formatIsoDate(item.date)}${days >= 0 ? ` (dans ${days} jour${days > 1 ? "s" : ""})` : ""}.`,
        url: `/sites/${site.id}`,
        tag: `renouvellement-${site.id}-${item.field}`,
      });
      await db.site.update({
        where: { id: site.id },
        data: {
          [item.field]:
            item.field === "sslReminderFor"
              ? new Date(`${item.date}T00:00:00Z`)
              : isoToDbDate(item.date),
        },
      });
      reminders += 1;
    }
  }
  return { sites: sites.length, reminders };
}

// ---------------------------------------------------------------------------
// Espace client
// ---------------------------------------------------------------------------

/** État des sites du client (seulement ceux que l'équipe montre). */
export async function portalSites(clientId: string) {
  const sites = await db.site.findMany({
    where: { clientId, monitor: true, showStatusToClient: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      statusChangedAt: true,
      lastCheckAt: true,
    },
  });
  if (sites.length === 0) return [];
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  const incidents = await db.siteIncident.findMany({
    where: {
      siteId: { in: sites.map((s) => s.id) },
      OR: [{ endedAt: null }, { endedAt: { gte: from } }],
    },
    select: { siteId: true, startedAt: true, endedAt: true },
  });
  return sites.map((site) => ({
    ...site,
    uptime30: uptimePercent(
      incidents.filter((i) => i.siteId === site.id),
      from,
      to,
    ),
  }));
}
