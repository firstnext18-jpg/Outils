import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientFilesCard } from "@/app/(app)/clients/[id]/client-files-card";
import { ProjectActions } from "@/app/(app)/projets/[id]/project-actions";
import { StepsEditor } from "@/app/(app)/projets/[id]/steps-editor";
import { ProgressBar } from "@/components/projects/progress-bar";
import { TimeEntries } from "@/components/time/time-entries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dbDateToIso, formatIsoDate, todayIso } from "@/domain/dates";
import { canEdit } from "@/domain/roles";
import { formatDuration, PROJECT_STATUS_LABELS, projectProgress } from "@/domain/time";
import { formatChf, formatDate, formatDateTime } from "@/lib/format";
import { listClientFiles } from "@/modules/files/service";
import { getProject } from "@/modules/projects/service";
import { getSettings } from "@/modules/settings/service";
import { projectTimeEntries } from "@/modules/time/service";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/projets/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = /^[0-9a-f-]{36}$/i.test(id) ? await getProject(id) : null;
  return { title: project ? `Projet · ${project.name}` : "Projet" };
}

export default async function ProjectPage({ params }: PageProps<"/projets/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const project = /^[0-9a-f-]{36}$/i.test(id) ? await getProject(id) : null;
  if (!project) notFound();
  const [entries, files, settings] = await Promise.all([
    projectTimeEntries(project.id),
    listClientFiles(project.clientId, { projectId: project.id }),
    getSettings(),
  ]);
  const editable = canEdit(user.role);
  const progress = projectProgress(project.steps);
  const minutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const unbilled = entries
    .filter((e) => e.billable && !e.invoice)
    .reduce((sum, e) => sum + e.minutes, 0);
  const rate = project.hourlyRateCents ?? settings.hourlyRateCents;
  const hasPortal = Boolean(project.client.account?.active);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/projets" className="text-muted-foreground text-sm hover:underline">
            ← Projets
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={`/clients/${project.clientId}`} className="hover:underline">
              {project.client.displayName}
            </Link>
            <Badge variant={project.status === "ACTIVE" ? "secondary" : "outline"}>
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
            {project.quote && (
              <Link
                href={`/devis/${project.quote.id}`}
                className="text-muted-foreground hover:underline"
              >
                Devis {project.quote.number}
              </Link>
            )}
          </div>
        </div>
        {editable && (
          <ProjectActions
            project={{
              id: project.id,
              name: project.name,
              status: project.status,
              clientId: project.clientId,
            }}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Avancement</CardTitle>
              <CardDescription>
                {hasPortal
                  ? "Le client voit ces étapes dans son espace."
                  : "Visible par le client s'il a accès à l'espace client."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <ProgressBar percent={progress.percent} label="Avancement du projet" />
                <span className="text-sm font-medium tabular-nums">{progress.percent} %</span>
              </div>
              <StepsEditor
                projectId={project.id}
                canEdit={editable}
                steps={project.steps.map((step) => ({
                  id: step.id,
                  label: step.label,
                  done: step.doneAt !== null,
                  doneInfo: step.doneAt
                    ? `Terminée le ${formatDate(step.doneAt)}${step.doneBy ? ` par ${step.doneBy.name}` : ""}`
                    : null,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {project.description && <p className="whitespace-pre-wrap">{project.description}</p>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Début</dt>
                <dd>{project.startDate ? formatIsoDate(dbDateToIso(project.startDate)) : "—"}</dd>
                <dt className="text-muted-foreground">Échéance</dt>
                <dd>{project.dueDate ? formatIsoDate(dbDateToIso(project.dueDate)) : "—"}</dd>
                <dt className="text-muted-foreground">Tarif horaire</dt>
                <dd>
                  {rate ? formatChf(rate) : "à définir"}
                  {!project.hourlyRateCents && rate ? " (par défaut)" : ""}
                </dd>
                <dt className="text-muted-foreground">Temps passé</dt>
                <dd>
                  {formatDuration(minutes)}
                  {project.budgetMinutes
                    ? ` sur ${formatDuration(project.budgetMinutes)} prévues`
                    : ""}
                </dd>
                <dt className="text-muted-foreground">Client</dt>
                <dd>
                  {project.showHoursToClient ? "voit le temps passé" : "ne voit pas le temps passé"}
                </dd>
              </dl>
              <p className="text-muted-foreground text-xs">
                Créé le {formatDateTime(project.createdAt)}
                {project.createdBy && ` par ${project.createdBy.name}`}.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Temps passé</CardTitle>
              <CardDescription>
                {formatDuration(minutes)} au total
                {unbilled > 0 &&
                  ` · ${formatDuration(unbilled)} facturable(s) pas encore facturé(s)`}
                {unbilled > 0 && (
                  <>
                    {" · "}
                    <Link href={`/temps?client=${project.clientId}`} className="underline">
                      Facturer
                    </Link>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeEntries
                canEdit={editable}
                today={todayIso()}
                showClient={false}
                projects={[{ id: project.id, name: project.name, clientId: project.clientId }]}
                fixed={{
                  client: {
                    id: project.clientId,
                    displayName: project.client.displayName,
                    city: "",
                    language: "FR",
                    siteTypeId: null,
                  },
                  projectId: project.id,
                }}
                entries={entries.map((e) => ({
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

          <ClientFilesCard
            title="Fichiers du projet"
            clientId={project.clientId}
            projectId={project.id}
            canEdit={editable}
            hasPortal={hasPortal}
            files={files.map((file) => ({
              id: file.id,
              name: file.name,
              size: file.size,
              meta: `${formatDateTime(file.createdAt)} · ${
                file.uploadedByClient ? project.client.displayName : (file.uploadedBy?.name ?? "—")
              }`,
              visibleToClient: file.visibleToClient,
              uploadedByClient: file.uploadedByClient,
              project: null,
              inDiscussion: file.messageId !== null,
            }))}
          />
        </div>
      </div>
    </>
  );
}
