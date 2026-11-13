import type { Metadata } from "next";
import Link from "next/link";
import { BillTimeButton } from "@/app/(app)/temps/bill-button";
import { TimerCard } from "@/app/(app)/temps/timer-card";
import { PageHeader } from "@/components/page-header";
import { TimeEntries } from "@/components/time/time-entries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dbDateToIso, formatIsoDate, todayIso } from "@/domain/dates";
import { canEdit } from "@/domain/roles";
import { formatDuration } from "@/domain/time";
import { openProjectOptions } from "@/modules/projects/service";
import { timeListParamsSchema } from "@/modules/time/schemas";
import { listTimeEntries, runningTimer, unbilledByClient } from "@/modules/time/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Temps" };

export default async function TimePage({ searchParams }: PageProps<"/temps">) {
  const user = await requireUser();
  const params = timeListParamsSchema.parse(await searchParams);
  const [list, running, unbilled, projects] = await Promise.all([
    listTimeEntries(params),
    runningTimer(user.id),
    unbilledByClient(),
    openProjectOptions(),
  ]);
  const editable = canEdit(user.role);
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }));

  return (
    <>
      <PageHeader
        title="Temps"
        description="Chronomètre, saisies et facturation du temps passé pour les clients."
      />

      {editable && (
        <TimerCard
          projects={projectOptions}
          running={
            running?.startedAt
              ? {
                  startedAt: running.startedAt.toISOString(),
                  client: running.client.displayName,
                  project: running.project?.name ?? null,
                  description: running.description,
                }
              : null
          }
        />
      )}

      {unbilled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>À facturer</CardTitle>
            <CardDescription>
              Temps facturable pas encore facturé. Une facture (brouillon) reprend tout le temps du
              client, une ligne par projet, au tarif horaire du projet ou des paramètres.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border" aria-label="Temps à facturer">
              {unbilled.map((row) => (
                <li key={row.client.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <Link
                    href={`/clients/${row.client.id}`}
                    className="flex-1 font-medium hover:underline"
                  >
                    {row.client.displayName}
                  </Link>
                  <span className="text-muted-foreground">{row.entries} saisie(s)</span>
                  <span className="font-medium tabular-nums">{formatDuration(row.minutes)}</span>
                  {editable && (
                    <BillTimeButton clientId={row.client.id} clientName={row.client.displayName} />
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle>Saisies</CardTitle>
            <CardDescription>
              Du {formatIsoDate(list.from)} au {formatIsoDate(list.to)} :{" "}
              {formatDuration(list.total)} au total, dont {formatDuration(list.billable)}{" "}
              facturable(s).
            </CardDescription>
          </div>
          <form className="flex flex-wrap items-end gap-3" method="get">
            {params.client && <input type="hidden" name="client" value={params.client} />}
            <div className="space-y-1">
              <Label htmlFor="time-from">Du</Label>
              <Input
                id="time-from"
                type="date"
                name="du"
                defaultValue={list.from}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="time-to">Au</Label>
              <Input id="time-to" type="date" name="au" defaultValue={list.to} className="w-40" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                name="facture"
                value="non"
                defaultChecked={params.facture === "non"}
              />
              Non facturé seulement
            </label>
            <Button type="submit" variant="outline" size="sm">
              Afficher
            </Button>
            {params.client && (
              <Link href="/temps" className="pb-2 text-sm underline">
                Tous les clients
              </Link>
            )}
          </form>
        </CardHeader>
        <CardContent>
          <TimeEntries
            canEdit={editable}
            today={todayIso()}
            projects={projectOptions}
            entries={list.entries.map((e) => ({
              id: e.id,
              date: dbDateToIso(e.date),
              dateLabel: formatIsoDate(dbDateToIso(e.date)),
              minutes: e.minutes,
              description: e.description,
              billable: e.billable,
              invoice: e.invoice,
              client: e.client,
              project: e.project,
              user: e.user.name,
            }))}
          />
        </CardContent>
      </Card>
    </>
  );
}
