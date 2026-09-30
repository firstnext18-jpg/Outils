import type { Metadata } from "next";
import { LayoutDashboardIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const user = await requireUser();
  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  return (
    <>
      <PageHeader
        title={`Bonjour ${firstName}`}
        description="Voici l'essentiel de votre activité."
      />
      <EmptyState
        icon={LayoutDashboardIcon}
        title="Le tableau de bord arrive bientôt"
        description="Chiffre d'affaires, factures impayées, devis en attente et meilleurs clients s'afficheront ici (phase 8)."
      />
    </>
  );
}
