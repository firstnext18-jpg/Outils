import type { Metadata } from "next";
import { PortalProjectCards } from "@/components/portal/project-cards";
import { portalTexts } from "@/i18n/portal";
import { portalProjects } from "@/modules/projects/service";
import { requirePortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Projets · Projekte" };

export default async function PortalProjectsPage() {
  const { client } = await requirePortalSession();
  const t = portalTexts(client.language);
  const projects = await portalProjects(client.id);
  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.navProjects}</h1>
        <p className="text-muted-foreground text-sm">{t.projectsHelp}</p>
      </div>
      {projects.length > 0 ? (
        <PortalProjectCards projects={projects} t={t} />
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          {t.noProjects}
        </p>
      )}
    </>
  );
}
