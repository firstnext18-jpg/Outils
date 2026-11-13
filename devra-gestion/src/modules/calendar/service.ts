import "server-only";
import type { CalendarItem } from "@/domain/calendar";
import { addDays, dbDateToIso, isoToDbDate, todayIso } from "@/domain/dates";
import { buildIcs } from "@/domain/ics";
import { outstandingCents } from "@/domain/invoice-status";
import { formatChf } from "@/lib/format";
import { displayCompanyName, getSettings } from "@/modules/settings/service";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { generateToken, hashToken } from "@/server/tokens";

/** Échéances entre deux dates (incluses), triées par date. */
export async function calendarItems(from: string, to: string): Promise<CalendarItem[]> {
  const range = { gte: isoToDbDate(from), lte: isoToDbDate(to) };
  const [invoices, quotes, subscriptions, projects, sites] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: range },
      select: {
        id: true,
        number: true,
        dueDate: true,
        amountDueCents: true,
        feesCents: true,
        paidCents: true,
        client: { select: { displayName: true } },
      },
    }),
    db.quote.findMany({
      where: { status: "SENT", validUntil: range },
      select: {
        id: true,
        number: true,
        validUntil: true,
        totalCents: true,
        client: { select: { displayName: true } },
      },
    }),
    db.subscription.findMany({
      where: { status: "ACTIVE", nextBillingDate: range },
      select: {
        id: true,
        label: true,
        nextBillingDate: true,
        client: { select: { displayName: true } },
      },
    }),
    db.project.findMany({
      where: { status: { not: "DONE" }, dueDate: range },
      select: { id: true, name: true, dueDate: true, client: { select: { displayName: true } } },
    }),
    db.site.findMany({
      where: {
        OR: [
          { domainExpiresAt: range },
          { hostingRenewsAt: range },
          {
            sslExpiresAt: {
              gte: new Date(`${from}T00:00:00Z`),
              lt: new Date(`${addDays(to, 1)}T00:00:00Z`),
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        domain: true,
        hostingProvider: true,
        domainExpiresAt: true,
        hostingRenewsAt: true,
        sslExpiresAt: true,
        client: { select: { displayName: true } },
      },
    }),
  ]);

  const items: CalendarItem[] = [];
  for (const invoice of invoices) {
    const outstanding = outstandingCents(invoice);
    items.push({
      uid: `facture-${invoice.id}`,
      kind: "invoice",
      date: dbDateToIso(invoice.dueDate),
      title: `Facture ${invoice.number ?? ""} à payer · ${invoice.client.displayName}`,
      detail: `Solde ${formatChf(outstanding)}`,
      href: `/factures/${invoice.id}`,
    });
  }
  for (const quote of quotes) {
    items.push({
      uid: `devis-${quote.id}`,
      kind: "quote",
      date: dbDateToIso(quote.validUntil),
      title: `Devis ${quote.number} valable jusqu'à ce jour · ${quote.client.displayName}`,
      detail: formatChf(quote.totalCents),
      href: `/devis/${quote.id}`,
    });
  }
  for (const subscription of subscriptions) {
    items.push({
      uid: `abonnement-${subscription.id}-${dbDateToIso(subscription.nextBillingDate)}`,
      kind: "subscription",
      date: dbDateToIso(subscription.nextBillingDate),
      title: `Facturation de l'abonnement · ${subscription.client.displayName}`,
      detail: subscription.label,
      href: `/abonnements/${subscription.id}`,
    });
  }
  for (const project of projects) {
    if (!project.dueDate) continue;
    items.push({
      uid: `projet-${project.id}`,
      kind: "project",
      date: dbDateToIso(project.dueDate),
      title: `Échéance du projet ${project.name} · ${project.client.displayName}`,
      detail: "",
      href: `/projets/${project.id}`,
    });
  }
  for (const site of sites) {
    const inRange = (date: string) => date >= from && date <= to;
    const domain = site.domainExpiresAt ? dbDateToIso(site.domainExpiresAt) : null;
    const hosting = site.hostingRenewsAt ? dbDateToIso(site.hostingRenewsAt) : null;
    const ssl = site.sslExpiresAt ? site.sslExpiresAt.toISOString().slice(0, 10) : null;
    if (domain && inRange(domain)) {
      items.push({
        uid: `domaine-${site.id}-${domain}`,
        kind: "domain",
        date: domain,
        title: `Expiration du domaine ${site.domain} · ${site.client.displayName}`,
        detail: site.name,
        href: `/sites/${site.id}`,
      });
    }
    if (hosting && inRange(hosting)) {
      items.push({
        uid: `hebergement-${site.id}-${hosting}`,
        kind: "hosting",
        date: hosting,
        title: `Renouvellement de l'hébergement · ${site.client.displayName}`,
        detail: [site.name, site.hostingProvider].filter(Boolean).join(" · "),
        href: `/sites/${site.id}`,
      });
    }
    if (ssl && inRange(ssl)) {
      items.push({
        uid: `certificat-${site.id}-${ssl}`,
        kind: "ssl",
        date: ssl,
        title: `Expiration du certificat HTTPS · ${site.client.displayName}`,
        detail: site.name,
        href: `/sites/${site.id}`,
      });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "fr"));
}

// ---------------------------------------------------------------------------
// Abonnement iCal (Outlook, Google Agenda, téléphone)
// ---------------------------------------------------------------------------

export async function hasCalendarFeed(userId: string) {
  return (await db.calendarFeed.count({ where: { userId } })) > 0;
}

/** Nouvelle adresse d'abonnement (l'ancienne cesse de fonctionner). Affichée une seule fois. */
export async function createCalendarFeed(userId: string) {
  const { token, tokenHash } = generateToken();
  await db.calendarFeed.upsert({
    where: { userId },
    create: { userId, tokenHash },
    update: { tokenHash, createdAt: new Date() },
  });
  return `${env().APP_URL}/api/calendrier/${token}`;
}

export async function deleteCalendarFeed(userId: string) {
  await db.calendarFeed.deleteMany({ where: { userId } });
}

/** Contenu iCal pour un jeton d'abonnement : de 3 mois en arrière à 15 mois en avant. */
export async function calendarFeedIcs(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const feed = await db.calendarFeed.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { user: { select: { active: true } } },
  });
  if (!feed?.user.active) return null;
  const today = todayIso();
  const [items, settings] = await Promise.all([
    calendarItems(addDays(today, -90), addDays(today, 456)),
    getSettings(),
  ]);
  const base = env().APP_URL;
  return buildIcs(
    items.map((item) => ({
      uid: `${item.uid}@gestion`,
      date: item.date,
      title: item.title,
      description: item.detail || undefined,
      url: `${base}${item.href}`,
    })),
    { name: `Échéances · ${displayCompanyName(settings)}` },
  );
}
