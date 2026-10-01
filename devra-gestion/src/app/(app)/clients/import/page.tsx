import type { Metadata } from "next";
import { ImportWizard } from "@/app/(app)/clients/import/import-wizard";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Importer des clients" };

export default async function ImportClientsPage() {
  await requireRole("MEMBER");
  return (
    <>
      <PageHeader
        title="Importer des clients"
        description="Depuis un fichier CSV ou Excel (.xlsx), par exemple exporté d'un tableur ou d'un autre logiciel."
      />
      <ImportWizard />
    </>
  );
}
