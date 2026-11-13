import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { ProgressBar } from "@/components/projects/progress-bar";
import { Badge } from "@/components/ui/badge";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { formatDuration, PROJECT_STATUS_LABELS } from "@/domain/time";
import type { ProjectListRow } from "@/modules/projects/service";

/** Liste des projets : client, avancement, temps passé (et budget), échéance. */
export function ProjectList({
  projects,
  showClient = true,
}: {
  projects: ProjectListRow[];
  showClient?: boolean;
}) {
  return (
    <ul className="divide-y rounded-md border" aria-label="Projets">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/projets/${project.id}`}
            className="hover:bg-muted/50 flex items-center gap-4 p-3 text-sm transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{project.name}</span>
                {showClient && (
                  <span className="text-muted-foreground">{project.client.displayName}</span>
                )}
                {project.status !== "ACTIVE" && (
                  <Badge variant="outline">{PROJECT_STATUS_LABELS[project.status]}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <ProgressBar
                  percent={project.progress.percent}
                  label={`Avancement de ${project.name}`}
                  className="max-w-48"
                />
                <span className="text-muted-foreground text-xs tabular-nums">
                  {project.progress.done}/{project.progress.total} étapes
                </span>
              </div>
            </div>
            <div className="text-muted-foreground text-right text-xs tabular-nums">
              <div>
                {formatDuration(project.minutes)}
                {project.budgetMinutes ? ` / ${formatDuration(project.budgetMinutes)}` : ""}
              </div>
              {project.dueDate && <div>Échéance {formatIsoDate(dbDateToIso(project.dueDate))}</div>}
            </div>
            <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
