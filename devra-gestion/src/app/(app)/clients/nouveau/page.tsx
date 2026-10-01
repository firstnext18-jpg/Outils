import type { Metadata } from "next";
import { ClientForm } from "@/app/(app)/clients/client-form";
import { PageHeader } from "@/components/page-header";
import { EMPTY_CLIENT } from "@/modules/clients/schemas";
import { getClientFilterOptions } from "@/modules/clients/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouveau client" };

export default async function NewClientPage() {
  await requireRole("MEMBER");
  const { siteTypes, tags } = await getClientFilterOptions();
  return (
    <>
      <PageHeader title="Nouveau client" />
      <ClientForm
        defaultValues={EMPTY_CLIENT}
        siteTypes={siteTypes.filter((t) => t.active)}
        tagSuggestions={tags}
      />
    </>
  );
}
