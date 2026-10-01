import type { Metadata } from "next";
import { InvoiceEditor } from "@/app/(app)/factures/invoice-editor";
import { PageHeader } from "@/components/page-header";
import { addDays, todayIso } from "@/domain/dates";
import { loadDocumentEditorData } from "@/modules/documents/editor-data";
import { invoiceEditorSettings } from "@/modules/settings/documents";
import { db } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouvelle facture" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/factures/nouvelle">) {
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
  const editorSettings = invoiceEditorSettings(settings);
  const language = client?.language ?? "FR";
  const issueDate = todayIso();

  return (
    <>
      <PageHeader
        title="Nouvelle facture"
        description="Elle reste un brouillon modifiable jusqu'à son émission, qui lui attribue son numéro."
      />
      <InvoiceEditor
        initialClient={client}
        settings={editorSettings}
        catalog={catalog}
        siteTypes={siteTypes}
        defaults={{
          clientId: client?.id ?? "",
          language,
          issueDate,
          dueDate: addDays(issueDate, editorSettings.paymentTermDays),
          subject: "",
          siteTypeId: client?.siteTypeId ?? null,
          introText: editorSettings.texts[language].intro,
          conditionsText: editorSettings.texts[language].conditions,
          globalDiscountType: "PERCENT",
          globalDiscountValue: "",
          lines: [],
        }}
      />
    </>
  );
}
