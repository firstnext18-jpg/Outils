import { SettingsNav } from "@/app/(app)/parametres/settings-nav";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/server/session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader title="Paramètres" description="Réservé aux administrateurs." />
      <SettingsNav />
      <div className="space-y-6">{children}</div>
    </>
  );
}
