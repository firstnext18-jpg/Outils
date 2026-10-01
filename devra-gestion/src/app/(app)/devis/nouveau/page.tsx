import type { Metadata } from "next";
import { loadDocumentEditorData } from "@/modules/documents/editor-data";
import { quoteEditorSettings } from "@/modules/settings/documents";
import { QuoteEditor } from "@/app/(app)/devis/quote-editor";
import { PageHeader } from "@/components/page-header";
import { addDays, todayIso } from "@/domain/dates";
import { db } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouveau devis" };

export default async function NewQuotePage({ searchParams }: PageProps<"/devis/nouveau">) {
  await requireRole("MEMBER");
  const { client: clientParam } = await searchParams;
  const client =
    typeof clientParam === "string" && /^[0-9a-f-]{36}$/i.test(clientParam)
      ? await db.client.findFirst({
          where: { id: clientParam, archivedAt: null },
          select: { id: true, displayName: true, city: true, language: true, siteTypeId: true },
        })
      : null;
  const { settings, catalog, siteTypes } = await loadDocumentEditorData(client?.siteTypeId);
  const editorSettings = quoteEditorSettings(settings);
  const language = client?.language ?? "FR";
  const issueDate = todayIso();

  return (
    <>
      <PageHeader title="Nouveau devis" description="Le numéro est attribué à l'enregistrement." />
      <QuoteEditor
        initialClient={client}
        settings={editorSettings}
        catalog={catalog}
        siteTypes={siteTypes}
        defaults={{
          clientId: client?.id ?? "",
          language,
          issueDate,
          validUntil: addDays(issueDate, editorSettings.quoteValidityDays),
          subject: "",
          siteTypeId: client?.siteTypeId ?? null,
          introText: editorSettings.texts[language].intro,
          conditionsText: editorSettings.texts[language].conditions,
          globalDiscountType: "PERCENT",
          globalDiscountValue: "",
          depositType: "PERCENT",
          depositValue: "",
          lines: [],
        }}
      />
    </>
  );
}
