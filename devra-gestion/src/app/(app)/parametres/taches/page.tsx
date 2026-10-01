import type { Metadata } from "next";
import { RunTasksButton } from "@/app/(app)/parametres/taches/run-tasks-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { lastTaskRuns, type DailySummary } from "@/modules/tasks/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Tâches" };

/** « 2 devis expirés · 3 factures d'abonnement · 1 relance à envoyer » */
function describe(summary: DailySummary | null): string {
  if (!summary) return "En cours…";
  const parts = [
    `${summary.expiredQuotes ?? 0} devis expiré(s)`,
    `${summary.subscriptionInvoices ?? 0} facture(s) d'abonnement`,
  ];
  if (summary.subscriptionEmails?.sent) parts.push(`${summary.subscriptionEmails.sent} envoyée(s)`);
  const reminders = summary.reminders;
  if (reminders?.mode === "MANUAL") parts.push(`${reminders.toSend} relance(s) à envoyer`);
  if (reminders?.mode === "AUTOMATIC") {
    parts.push(`${reminders.sent} relance(s) envoyée(s)`);
    if (reminders.failed) parts.push(`${reminders.failed} échec(s)`);
    if (reminders.withoutEmail) parts.push(`${reminders.withoutEmail} sans email`);
  }
  return parts.join(" · ");
}

export default async function TasksPage() {
  await requireRole("ADMIN");
  const runs = await lastTaskRuns();
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Tâches quotidiennes</CardTitle>
          <CardDescription>
            Chaque matin, le conteneur « cron » passe les devis échus en « expiré », génère les
            factures d&apos;abonnement et traite les relances. Vous pouvez aussi les lancer à la
            main (sans risque : rien n&apos;est fait deux fois).
          </CardDescription>
        </div>
        <RunTasksButton />
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune exécution pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y text-sm">
            {runs.map((run) => (
              <li key={run.id} className="space-y-0.5 py-2 first:pt-0 last:pb-0">
                <p className="font-medium">
                  {formatDateTime(run.startedAt)}
                  <span className="text-muted-foreground font-normal">
                    {" · "}
                    {run.trigger === "cron" ? "automatique" : `lancé par ${run.user?.name ?? "—"}`}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {describe(run.finishedAt ? (run.summary as DailySummary | null) : null)}
                </p>
                {run.error && <p className="text-destructive whitespace-pre-wrap">{run.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
