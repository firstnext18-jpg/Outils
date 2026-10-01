import type { Metadata } from "next";
import {
  BellRingIcon,
  FileDownIcon,
  FilePlusIcon,
  ReceiptTextIcon,
  SearchXIcon,
} from "lucide-react";
import Link from "next/link";
import { InvoicesToolbar } from "@/app/(app)/factures/invoices-toolbar";
import { InvoicesList } from "@/components/documents/invoices-list";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PaginationLinks } from "@/components/pagination-links";
import { Button } from "@/components/ui/button";
import { canEdit } from "@/domain/roles";
import { invoiceListParamsSchema } from "@/modules/invoices/schemas";
import { countAllInvoices, listInvoices } from "@/modules/invoices/service";
import { reminderProposals } from "@/modules/reminders/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Factures" };

export default async function InvoicesPage({ searchParams }: PageProps<"/factures">) {
  const user = await requireUser();
  const params = invoiceListParamsSchema.parse(await searchParams);
  const [{ invoices, total, page, pageCount }, allCount, reminders] = await Promise.all([
    listInvoices(params),
    countAllInvoices(),
    reminderProposals(),
  ]);
  const newButton = canEdit(user.role) && (
    <Button asChild>
      <Link href="/factures/nouvelle">
        <FilePlusIcon /> Nouvelle facture
      </Link>
    </Button>
  );
  const remindersButton = (
    <Button asChild variant="outline">
      <Link href="/factures/relances">
        <BellRingIcon /> Relances à envoyer
        {reminders.length > 0 && (
          <span className="bg-destructive ml-1 rounded-full px-1.5 text-xs text-white tabular-nums">
            {reminders.length}
          </span>
        )}
      </Link>
    </Button>
  );

  if (allCount === 0) {
    return (
      <>
        <PageHeader title="Factures" />
        <EmptyState
          icon={ReceiptTextIcon}
          title="Aucune facture pour l'instant"
          description="Convertissez un devis accepté en facture en un clic, ou créez une facture directement."
          action={newButton}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Factures"
        description={`${total} facture${total > 1 ? "s" : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/factures/export">
                <FileDownIcon /> Export comptable
              </Link>
            </Button>
            {remindersButton}
            {newButton}
          </div>
        }
      />
      <InvoicesToolbar />
      {invoices.length > 0 ? (
        <>
          <InvoicesList invoices={invoices} />
          <PaginationLinks
            pathname="/factures"
            query={{ ...params, page: undefined }}
            page={page}
            pageCount={pageCount}
          />
        </>
      ) : (
        <EmptyState
          icon={SearchXIcon}
          title="Aucune facture ne correspond"
          description="Modifiez la recherche ou le filtre."
        />
      )}
    </>
  );
}
