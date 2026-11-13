import type { Metadata } from "next";
import { ProjectSiteSettingsForm } from "@/app/(app)/parametres/projets-sites/project-site-settings-form";
import { formatAmount } from "@/lib/format";
import { getSettings } from "@/modules/settings/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Projets et sites" };

export default async function ProjectSiteSettingsPage() {
  await requireRole("ADMIN");
  const settings = await getSettings();
  return (
    <ProjectSiteSettingsForm
      defaultValues={{
        hourlyRate: settings.hourlyRateCents ? formatAmount(settings.hourlyRateCents) : "",
        renewalReminderDays: String(settings.renewalReminderDays),
        monitorAlertEmail: settings.monitorAlertEmail,
      }}
    />
  );
}
