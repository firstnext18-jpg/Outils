import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/app/(app)/projets/project-form";
import { dbDateToIso } from "@/domain/dates";
import { formatAmount, formatChf } from "@/lib/format";
import { getProject } from "@/modules/projects/service";
import { getSettings } from "@/modules/settings/service";
import { db } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Modifier le projet" };

export default async function EditProjectPage({ params }: PageProps<"/projets/[id]/modifier">) {
  await requireRole("MEMBER");
  const { id } = await params;
  const project = /^[0-9a-f-]{36}$/i.test(id) ? await getProject(id) : null;
  if (!project) notFound();
  const [client, settings] = await Promise.all([
    db.client.findUnique({
      where: { id: project.clientId },
      select: { id: true, displayName: true, city: true, language: true, siteTypeId: true },
    }),
    getSettings(),
  ]);
  return (
    <>
      <div className="space-y-2">
        <Link
          href={`/projets/${project.id}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Modifier le projet</h1>
      </div>
      <ProjectForm
        projectId={project.id}
        client={client}
        defaultValues={{
          clientId: project.clientId,
          name: project.name,
          description: project.description,
          startDate: project.startDate ? dbDateToIso(project.startDate) : "",
          dueDate: project.dueDate ? dbDateToIso(project.dueDate) : "",
          hourlyRate: project.hourlyRateCents ? formatAmount(project.hourlyRateCents) : "",
          budgetHours: project.budgetMinutes
            ? String(Math.round((project.budgetMinutes / 60) * 100) / 100)
            : "",
          showHoursToClient: project.showHoursToClient,
        }}
        defaultRateLabel={
          settings.hourlyRateCents ? formatChf(settings.hourlyRateCents) : "à définir"
        }
      />
    </>
  );
}
