import type { Metadata } from "next";
import { FilePlusIcon, FileTextIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { QuotesToolbar } from "@/app/(app)/devis/quotes-toolbar";
import { QuotesList } from "@/components/documents/quotes-list";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PaginationLinks } from "@/components/pagination-links";
import { Button } from "@/components/ui/button";
import { canEdit } from "@/domain/roles";
import { quoteListParamsSchema } from "@/modules/quotes/schemas";
import { countAllQuotes, expireQuotes, listQuotes } from "@/modules/quotes/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Devis" };

export default async function QuotesPage({ searchParams }: PageProps<"/devis">) {
  const user = await requireUser();
  const params = quoteListParamsSchema.parse(await searchParams);
  await expireQuotes();
  const [{ quotes, total, page, pageCount }, allCount] = await Promise.all([
    listQuotes(params),
    countAllQuotes(),
  ]);
  const editable = canEdit(user.role);
  const newButton = editable && (
    <Button asChild>
      <Link href="/devis/nouveau">
        <FilePlusIcon /> Nouveau devis
      </Link>
    </Button>
  );

  if (allCount === 0) {
    return (
      <>
        <PageHeader title="Devis" />
        <EmptyState
          icon={FileTextIcon}
          title="Aucun devis pour l'instant"
          description="Créez votre premier devis : choisissez un client, ajoutez des prestations du catalogue, et le PDF est prêt."
          action={newButton}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Devis" description={`${total} devis`} actions={newButton} />
      <QuotesToolbar />
      {quotes.length > 0 ? (
        <>
          <QuotesList quotes={quotes} />
          <PaginationLinks
            pathname="/devis"
            query={{ ...params, page: undefined }}
            page={page}
            pageCount={pageCount}
          />
        </>
      ) : (
        <EmptyState
          icon={SearchXIcon}
          title="Aucun devis ne correspond"
          description="Modifiez la recherche ou le filtre."
        />
      )}
    </>
  );
}
