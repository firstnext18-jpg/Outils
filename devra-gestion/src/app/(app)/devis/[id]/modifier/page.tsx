import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadDocumentEditorData } from "@/modules/documents/editor-data";
import { quoteEditorSettings } from "@/modules/settings/documents";
import { QuoteEditor } from "@/app/(app)/devis/quote-editor";
import { PageHeader } from "@/components/page-header";
import { isQuoteEditable } from "@/domain/quote-status";
import { quoteToInput } from "@/modules/quotes/form";
import { getQuote } from "@/modules/quotes/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Modifier le devis" };

export default async function EditQuotePage({ params }: PageProps<"/devis/[id]/modifier">) {
  await requireRole("MEMBER");
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) notFound();
  // Un devis envoyé se modifie après l'avoir repassé en brouillon.
  if (!isQuoteEditable(quote.status)) redirect(`/devis/${id}`);
  const { settings, catalog, siteTypes } = await loadDocumentEditorData(quote.siteTypeId);
  const editorSettings = quoteEditorSettings(settings);

  return (
    <>
      <PageHeader title={`Modifier le devis ${quote.number}`} />
      <QuoteEditor
        existing={{ id: quote.id, version: quote.version, number: quote.number }}
        initialClient={{
          id: quote.client.id,
          displayName: quote.client.displayName,
          city: quote.client.city,
          language: quote.client.language,
          siteTypeId: quote.client.siteTypeId,
        }}
        settings={editorSettings}
        catalog={catalog}
        siteTypes={siteTypes}
        defaults={quoteToInput(quote)}
      />
    </>
  );
}
