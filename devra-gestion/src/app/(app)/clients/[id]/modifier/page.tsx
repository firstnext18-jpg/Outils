import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientForm } from "@/app/(app)/clients/client-form";
import { PageHeader } from "@/components/page-header";
import { getClient, getClientFilterOptions } from "@/modules/clients/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Modifier le client" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/modifier">) {
  await requireRole("MEMBER");
  const { id } = await params;
  const [client, { siteTypes, tags }] = await Promise.all([
    getClient(id),
    getClientFilterOptions(),
  ]);
  if (!client) notFound();

  return (
    <>
      <PageHeader title={`Modifier ${client.displayName}`} />
      <ClientForm
        existing={{ id: client.id, version: client.version }}
        // Un type de site désactivé reste proposé s'il est déjà choisi pour ce client.
        siteTypes={siteTypes.filter((t) => t.active || t.id === client.siteTypeId)}
        tagSuggestions={tags}
        defaultValues={{
          kind: client.kind,
          firstName: client.firstName,
          lastName: client.lastName,
          companyName: client.companyName,
          contactName: client.contactName,
          street: client.street,
          streetNumber: client.streetNumber,
          postalCode: client.postalCode,
          city: client.city,
          canton: client.canton,
          country: client.country,
          email: client.email,
          phone: client.phone,
          website: client.website,
          siteTypeId: client.siteTypeId,
          language: client.language,
          notes: client.notes,
          tags: client.tags,
        }}
      />
    </>
  );
}
