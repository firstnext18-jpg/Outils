import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InvoiceEditor } from "@/app/(app)/factures/invoice-editor";
import { PageHeader } from "@/components/page-header";
import { INVOICE_TYPE_LABELS } from "@/domain/invoice-status";
import type { Deduction } from "@/domain/invoices";
import { loadDocumentEditorData } from "@/modules/documents/editor-data";
import { invoiceToInput } from "@/modules/invoices/form";
import { getInvoice } from "@/modules/invoices/service";
import { invoiceEditorSettings } from "@/modules/settings/documents";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Modifier la facture" };

export default async function EditInvoicePage({ params }: PageProps<"/factures/[id]/modifier">) {
  await requireRole("MEMBER");
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  // Une facture émise ne se modifie plus : on l'annule et on en crée une nouvelle.
  if (invoice.status !== "DRAFT") redirect(`/factures/${id}`);
  const { settings, catalog, siteTypes } = await loadDocumentEditorData(invoice.siteTypeId);

  return (
    <>
      <PageHeader
        title={`Modifier le brouillon (${INVOICE_TYPE_LABELS[invoice.type].toLowerCase()})`}
        description={invoice.quote ? `Devis d'origine : ${invoice.quote.number}` : undefined}
      />
      <InvoiceEditor
        existing={{ id: invoice.id, version: invoice.version }}
        initialClient={{
          id: invoice.client.id,
          displayName: invoice.client.displayName,
          city: invoice.client.city,
          language: invoice.client.language,
          siteTypeId: invoice.client.siteTypeId,
        }}
        settings={invoiceEditorSettings(settings)}
        catalog={catalog}
        siteTypes={siteTypes}
        defaults={invoiceToInput(invoice)}
        deductions={(invoice.deductions as Deduction[] | null) ?? []}
      />
    </>
  );
}
