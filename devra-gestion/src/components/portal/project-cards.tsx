import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { documentDate } from "@/components/portal/format";
import { ProgressBar } from "@/components/projects/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/domain/time";
import { fillLabel } from "@/i18n/documents";
import type { PortalTexts } from "@/i18n/portal";
import { formatDate } from "@/lib/format";
import type { PortalProject } from "@/modules/projects/service";

function statusLabel(status: PortalProject["status"], t: PortalTexts) {
  if (status === "DONE") return t.projectDone;
  if (status === "PAUSED") return t.projectPaused;
  return t.projectActive;
}

/** Projets du client : étapes, avancement et (si l'équipe le montre) temps passé. */
export function PortalProjectCards({
  projects,
  t,
  compact = false,
}: {
  projects: PortalProject[];
  t: PortalTexts;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <Card key={project.id} className={compact ? "gap-3 py-4" : undefined}>
          <CardHeader className={compact ? "px-4" : undefined}>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{project.name}</CardTitle>
              <Badge variant={project.status === "ACTIVE" ? "secondary" : "outline"}>
                {statusLabel(project.status, t)}
              </Badge>
            </div>
            {!compact && project.description && (
              <CardDescription className="whitespace-pre-wrap">
                {project.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className={compact ? "space-y-2 px-4" : "space-y-4"}>
            <div className="space-y-1">
              <ProgressBar percent={project.progress.percent} label={project.name} />
              <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
                <span>
                  {fillLabel(t.stepsDone, {
                    done: project.progress.done,
                    total: project.progress.total,
                  })}
                </span>
                {project.dueDate && (
                  <span>{fillLabel(t.projectDue, { date: documentDate(project.dueDate) })}</span>
                )}
              </div>
            </div>
            {!compact && (
              <ol className="space-y-1.5" aria-label={project.name}>
                {project.steps.map((step) => (
                  <li key={step.id} className="flex items-start gap-2 text-sm">
                    {step.doneAt ? (
                      <CheckCircle2Icon
                        className="text-primary mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                    ) : (
                      <CircleIcon
                        className="text-muted-foreground mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                    )}
                    <span className={step.doneAt ? "" : "text-muted-foreground"}>
                      {step.label}
                      {step.doneAt && (
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          — {fillLabel(t.stepDoneOn, { date: formatDate(step.doneAt) })}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {!compact && project.minutes !== null && (
              <div className="space-y-2 border-t pt-3 text-sm">
                <p className="font-medium">
                  {project.budgetMinutes
                    ? fillLabel(t.timeBudget, {
                        time: formatDuration(project.minutes),
                        budget: formatDuration(project.budgetMinutes),
                      })
                    : fillLabel(t.timeSpent, { time: formatDuration(project.minutes) })}
                </p>
                {project.timeEntries.length > 0 && (
                  <details>
                    <summary className="text-muted-foreground cursor-pointer text-sm">
                      {t.hoursDetail}
                    </summary>
                    <ul className="mt-2 divide-y rounded-md border">
                      {project.timeEntries.map((entry) => (
                        <li key={entry.id} className="flex gap-3 p-2 text-sm">
                          <span className="text-muted-foreground w-24 tabular-nums">
                            {documentDate(entry.date)}
                          </span>
                          <span className="flex-1">{entry.description}</span>
                          <span className="tabular-nums">{formatDuration(entry.minutes)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
