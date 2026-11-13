import type { Metadata } from "next";
import { FolderKanbanIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProjectList } from "@/components/projects/project-list";
import { Button } from "@/components/ui/button";
import { canEdit } from "@/domain/roles";
import { cn } from "@/lib/utils";
import { listProjects } from "@/modules/projects/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Projets" };

const FILTERS = {
  "en-cours": { label: "En cours", status: "ACTIVE" },
  "en-pause": { label: "En pause", status: "PAUSED" },
  termines: { label: "Terminés", status: "DONE" },
  tous: { label: "Tous", status: undefined },
} as const;

export default async function ProjectsPage({ searchParams }: PageProps<"/projets">) {
  const user = await requireUser();
  const { statut } = await searchParams;
  const filter =
    typeof statut === "string" && statut in FILTERS ? (statut as keyof typeof FILTERS) : "en-cours";
  const projects = await listProjects({ status: FILTERS[filter].status });

  return (
    <>
      <PageHeader
        title="Projets"
        description="Avancement des projets (visible par le client dans son espace) et temps passé."
        actions={
          canEdit(user.role) && (
            <Button asChild>
              <Link href="/projets/nouveau">
                <PlusIcon /> Nouveau projet
              </Link>
            </Button>
          )
        }
      />
      <nav className="flex flex-wrap gap-1" aria-label="Filtrer les projets">
        {Object.entries(FILTERS).map(([key, { label }]) => (
          <Link
            key={key}
            href={key === "en-cours" ? "/projets" : `/projets?statut=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              filter === key ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {projects.length > 0 ? (
        <ProjectList projects={projects} />
      ) : (
        <EmptyState
          icon={FolderKanbanIcon}
          title="Aucun projet"
          description="Créez un projet pour suivre ses étapes et le temps passé, depuis cette page ou la fiche du client."
        />
      )}
    </>
  );
}
