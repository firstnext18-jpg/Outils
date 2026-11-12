import type { Metadata } from "next";
import { InvoiceRows } from "@/components/portal/invoice-rows";
import { portalTexts } from "@/i18n/portal";
import { portalInvoices } from "@/modules/portal/service";
import { requirePortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Factures · Rechnungen" };

export default async function PortalInvoicesPage() {
  const { client } = await requirePortalSession();
  const t = portalTexts(client.language);
  const invoices = await portalInvoices(client.id);
  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.navInvoices}</h1>
        <p className="text-muted-foreground text-sm">{t.invoicesHelp}</p>
      </div>
      {invoices.length > 0 ? (
        <InvoiceRows invoices={invoices} t={t} language={client.language} />
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          {t.noInvoices}
        </p>
      )}
    </>
  );
}
