import type { Metadata } from "next";
import { SearchXIcon, UploadIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { ClientsList } from "@/app/(app)/clients/clients-list";
import { ClientsToolbar } from "@/app/(app)/clients/clients-toolbar";
import { ExportMenu } from "@/app/(app)/clients/export-menu";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PaginationLinks } from "@/components/pagination-links";
import { Button } from "@/components/ui/button";
import { canEdit } from "@/domain/roles";
import { clientListParamsSchema } from "@/modules/clients/schemas";
import { countAllClients, getClientFilterOptions, listClients } from "@/modules/clients/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const user = await requireUser();
  const params = clientListParamsSchema.parse(await searchParams);
  const [{ clients, total, page, pageCount }, options, allCount] = await Promise.all([
    listClients(params),
    getClientFilterOptions(),
    countAllClients(),
  ]);
  const editable = canEdit(user.role);

  const newClientButton = (
    <Button asChild>
      <Link href="/clients/nouveau">
        <UserPlusIcon /> Nouveau client
      </Link>
    </Button>
  );

  if (allCount === 0) {
    return (
      <>
        <PageHeader title="Clients" />
        <EmptyState
          icon={UsersIcon}
          title="Aucun client pour l'instant"
          description={
            editable
              ? "Ajoutez votre premier client, ou importez votre liste existante depuis un fichier CSV ou Excel."
              : "Les clients ajoutés par l'équipe apparaîtront ici."
          }
          action={
            editable && (
              <div className="flex flex-wrap justify-center gap-2">
                {newClientButton}
                <Button asChild variant="outline">
                  <Link href="/clients/import">
                    <UploadIcon /> Importer un fichier
                  </Link>
                </Button>
              </div>
            )
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${total} client${total > 1 ? "s" : ""}`}
        actions={
          <>
            <ExportMenu />
            {editable && (
              <>
                <Button asChild variant="outline">
                  <Link href="/clients/import">
                    <UploadIcon /> Importer
                  </Link>
                </Button>
                {newClientButton}
              </>
            )}
          </>
        }
      />
      <ClientsToolbar siteTypes={options.siteTypes} tags={options.tags} />
      {clients.length > 0 ? (
        <>
          <ClientsList clients={clients} />
          <PaginationLinks
            pathname="/clients"
            query={{ ...params, page: undefined }}
            page={page}
            pageCount={pageCount}
          />
        </>
      ) : (
        <EmptyState
          icon={SearchXIcon}
          title="Aucun client ne correspond"
          description="Modifiez la recherche ou les filtres."
        />
      )}
    </>
  );
}
