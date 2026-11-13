import type { Metadata } from "next";
import Link from "next/link";
import { ProjectForm } from "@/app/(app)/projets/project-form";
import { formatChf } from "@/lib/format";
import { listOptions } from "@/modules/lists/service";
import { getSettings } from "@/modules/settings/service";
import { db } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouveau projet" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projets/nouveau">) {
  await requireRole("MEMBER");
  const { client: clientId } = await searchParams;
  const [client, steps, settings] = await Promise.all([
    typeof clientId === "string" && /^[0-9a-f-]{36}$/i.test(clientId)
      ? db.client.findUnique({
          where: { id: clientId },
          select: { id: true, displayName: true, city: true, language: true, siteTypeId: true },
        })
      : null,
    listOptions("PROJECT_STEP"),
    getSettings(),
  ]);
  return (
    <>
      <div className="space-y-2">
        <Link href="/projets" className="text-muted-foreground text-sm hover:underline">
          ← Projets
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau projet</h1>
      </div>
      <ProjectForm
        client={client}
        defaultValues={{
          clientId: client?.id ?? "",
          name: "",
          description: "",
          startDate: "",
          dueDate: "",
          hourlyRate: "",
          budgetHours: "",
          showHoursToClient: true,
        }}
        defaultSteps={steps.filter((s) => s.active).map((s) => s.name)}
        defaultRateLabel={
          settings.hourlyRateCents ? formatChf(settings.hourlyRateCents) : "à définir"
        }
      />
    </>
  );
}
