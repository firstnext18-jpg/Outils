import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteActions } from "@/app/(app)/sites/[id]/site-actions";
import { RenewalLine, renewalsOf, SiteStatusBadge } from "@/components/sites/site-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { todayIso } from "@/domain/dates";
import { canEdit } from "@/domain/roles";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSettings } from "@/modules/settings/service";
import { getSite } from "@/modules/sites/service";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/sites/[id]">): Promise<Metadata> {
  const { id } = await params;
  const site = /^[0-9a-f-]{36}$/i.test(id) ? await getSite(id) : null;
  return { title: site ? `Site · ${site.name}` : "Site" };
}

/** Durée lisible d'une panne : « 12 min », « 3 h 05 », « 2 j 4 h ». */
function outage(start: Date, end: Date | null): string {
  const minutes = Math.max(
    1,
    Math.round(((end ?? new Date()).getTime() - start.getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
  return `${Math.floor(hours / 24)} j ${hours % 24} h`;
}

export default async function SitePage({ params }: PageProps<"/sites/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const site = /^[0-9a-f-]{36}$/i.test(id) ? await getSite(id) : null;
  if (!site) notFound();
  const settings = await getSettings();
  const renewals = renewalsOf(site, todayIso());

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/sites" className="text-muted-foreground text-sm hover:underline">
            ← Sites
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{site.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/clients/${site.clientId}`} className="hover:underline">
              {site.client.displayName}
            </Link>
            <SiteStatusBadge site={site} />
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:underline"
            >
              {site.url.replace(/^https?:\/\//, "")} ↗
            </a>
          </div>
        </div>
        {canEdit(user.role) && (
          <SiteActions site={{ id: site.id, name: site.name, clientId: site.clientId }} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Surveillance</CardTitle>
            <CardDescription>
              {site.monitor
                ? site.showStatusToClient
                  ? "Vérifié toutes les quelques minutes. Le client voit l'état du site dans son espace."
                  : "Vérifié toutes les quelques minutes. Le client ne voit pas l'état du site."
                : "Ce site n'est pas surveillé."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Disponibilité (30 jours)</dt>
              <dd className="tabular-nums">{site.monitor ? `${site.uptime30} %` : "—"}</dd>
              <dt className="text-muted-foreground">Dernière vérification</dt>
              <dd>{site.lastCheckAt ? formatDateTime(site.lastCheckAt) : "—"}</dd>
              <dt className="text-muted-foreground">Temps de réponse</dt>
              <dd className="tabular-nums">
                {site.lastResponseMs !== null ? `${site.lastResponseMs} ms` : "—"}
              </dd>
              {site.lastError && (
                <>
                  <dt className="text-muted-foreground">Dernière erreur</dt>
                  <dd className="text-destructive">{site.lastError}</dd>
                </>
              )}
              {site.statusChangedAt && (
                <>
                  <dt className="text-muted-foreground">
                    {site.status === "DOWN" ? "Hors ligne depuis" : "En ligne depuis"}
                  </dt>
                  <dd>{formatDateTime(site.statusChangedAt)}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domaine et hébergement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Domaine</dt>
              <dd>
                {site.domain}
                {site.registrar ? ` · ${site.registrar}` : ""}
              </dd>
              <dt className="text-muted-foreground">Hébergeur</dt>
              <dd>{site.hostingProvider || "—"}</dd>
              {site.domainExpiryAuto && (
                <>
                  <dt className="text-muted-foreground">Lecture automatique</dt>
                  <dd>
                    {site.domainCheckedAt
                      ? `Dernière lecture le ${formatDate(site.domainCheckedAt)}`
                      : "Pas encore lue"}
                  </dd>
                </>
              )}
            </dl>
            <div className="space-y-1">
              <h2 className="font-medium">Échéances</h2>
              {renewals.length > 0 ? (
                <ul className="space-y-1">
                  {renewals.map((renewal) => (
                    <li key={renewal.kind}>
                      <RenewalLine renewal={renewal} soonDays={settings.renewalReminderDays} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  Aucune date connue. Saisissez la date d&apos;expiration du domaine et celle du
                  renouvellement de l&apos;hébergement pour recevoir un rappel.
                </p>
              )}
            </div>
            {site.notes && (
              <p className="text-muted-foreground whitespace-pre-wrap">{site.notes}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {site.monitor && (
        <Card>
          <CardHeader>
            <CardTitle>Pannes</CardTitle>
            <CardDescription>Les 20 dernières.</CardDescription>
          </CardHeader>
          <CardContent>
            {site.incidents.length > 0 ? (
              <ul className="divide-y text-sm" aria-label="Pannes">
                {site.incidents.map((incident) => (
                  <li
                    key={incident.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  >
                    <span>
                      {formatDateTime(incident.startedAt)}
                      {incident.endedAt ? ` → ${formatDateTime(incident.endedAt)}` : " · en cours"}
                      {incident.error && (
                        <span className="text-muted-foreground"> · {incident.error}</span>
                      )}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {outage(incident.startedAt, incident.endedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Aucune panne enregistrée.</p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
