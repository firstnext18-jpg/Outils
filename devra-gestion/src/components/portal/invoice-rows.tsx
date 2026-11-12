import { FileDownIcon } from "lucide-react";
import { documentDate, invoiceTypeLabel, labelled } from "@/components/portal/format";
import { InvoiceStatusBadge } from "@/components/portal/status-badges";
import { formatIsoDate } from "@/domain/dates";
import { formatIban } from "@/domain/iban";
import { formatReference } from "@/domain/qr-reference";
import { fillLabel } from "@/i18n/documents";
import type { PortalLanguage, PortalTexts } from "@/i18n/portal";
import { formatChf } from "@/lib/format";
import type { PortalInvoiceRow } from "@/modules/portal/service";

function PdfLink({ id, number, t }: { id: string; number: string | null; t: PortalTexts }) {
  return (
    <a
      href={`/api/espace-client/factures/${id}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      aria-label={`${t.downloadPdf} ${number ?? ""}`.trim()}
    >
      <FileDownIcon className="size-4" /> PDF
    </a>
  );
}

/**
 * Factures du client. En mode « à payer » : solde, échéance et informations
 * de paiement (compte et référence de la QR-facture).
 */
export function InvoiceRows({
  invoices,
  t,
  language,
  toPay = false,
}: {
  invoices: PortalInvoiceRow[];
  t: PortalTexts;
  language: PortalLanguage;
  toPay?: boolean;
}) {
  return (
    <ul className="divide-y rounded-md border" aria-label={toPay ? t.toPayTitle : t.navInvoices}>
      {invoices.map((invoice) => {
        const due = formatIsoDate(invoice.dueDate);
        return (
          <li key={invoice.id} className="space-y-2 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {invoiceTypeLabel(invoice.type, language)} {invoice.number}
                  </span>
                  <InvoiceStatusBadge status={invoice.status} t={t} />
                </div>
                {invoice.subject && <p className="text-muted-foreground">{invoice.subject}</p>}
                <p className="text-muted-foreground text-xs">
                  {labelled(language, t.date)} {documentDate(invoice.issueDate)}
                  {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                    <>
                      {" · "}
                      {invoice.status === "OVERDUE"
                        ? fillLabel(t.overdueSince, { date: due })
                        : fillLabel(t.dueOn, { date: due })}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-semibold whitespace-nowrap tabular-nums">
                    {formatChf(
                      toPay ? invoice.outstandingCents : invoice.amountDueCents + invoice.feesCents,
                    )}
                  </div>
                  {!toPay && invoice.outstandingCents > 0 && invoice.status !== "CANCELLED" && (
                    <div className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                      {labelled(language, t.balance)} {formatChf(invoice.outstandingCents)}
                    </div>
                  )}
                </div>
                <PdfLink id={invoice.id} number={invoice.number} t={t} />
              </div>
            </div>
            {toPay && invoice.paymentAccount && (
              <dl className="bg-muted/50 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md px-3 py-2 text-xs">
                <dt className="text-muted-foreground">{t.paymentAccount}</dt>
                <dd className="font-mono">{formatIban(invoice.paymentAccount)}</dd>
                {invoice.paymentReference && (
                  <>
                    <dt className="text-muted-foreground">{t.paymentReference}</dt>
                    <dd className="font-mono">{formatReference(invoice.paymentReference)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">{t.paymentAmount}</dt>
                <dd className="font-mono">{formatChf(invoice.outstandingCents)}</dd>
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
