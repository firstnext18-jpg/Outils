import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/documents/invoice-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dbDateToIso, formatIsoDate, todayIso } from "@/domain/dates";
import { displayStatus, INVOICE_TYPE_LABELS, outstandingCents } from "@/domain/invoice-status";
import { formatChf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceListRow } from "@/modules/invoices/service";

function status(invoice: InvoiceListRow, today: string) {
  return displayStatus(invoice.status, dbDateToIso(invoice.dueDate), today);
}

function Amount({ invoice }: { invoice: InvoiceListRow }) {
  const open = invoice.status === "SENT" || invoice.status === "PARTIALLY_PAID";
  const balance = outstandingCents(invoice);
  return (
    <div className="text-right tabular-nums">
      <div className={cn("font-medium", invoice.status === "CANCELLED" && "line-through")}>
        {formatChf(invoice.amountDueCents)}
      </div>
      {open && invoice.paidCents > 0 && (
        <div className="text-muted-foreground text-xs">Solde {formatChf(balance)}</div>
      )}
    </div>
  );
}

function InvoiceNumber({ invoice }: { invoice: InvoiceListRow }) {
  return invoice.number ? (
    <span className="tabular-nums">{invoice.number}</span>
  ) : (
    <span className="text-muted-foreground italic">Brouillon</span>
  );
}

/** Liste de factures : tableau sur grand écran, cartes sur téléphone. */
export function InvoicesList({
  invoices,
  showClient = true,
}: {
  invoices: InvoiceListRow[];
  showClient?: boolean;
}) {
  const today = todayIso();
  return (
    <>
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Numéro</TableHead>
              {showClient && <TableHead>Client</TableHead>}
              <TableHead>Objet</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id} className="relative">
                <TableCell className="pl-4">
                  <Link
                    href={`/factures/${invoice.id}`}
                    className="font-medium after:absolute after:inset-0 hover:underline"
                  >
                    <InvoiceNumber invoice={invoice} />
                  </Link>
                  {invoice.type !== "STANDARD" && (
                    <div className="text-muted-foreground text-xs">
                      {INVOICE_TYPE_LABELS[invoice.type]}
                    </div>
                  )}
                </TableCell>
                {showClient && <TableCell>{invoice.client.displayName}</TableCell>}
                <TableCell className="text-muted-foreground max-w-56 truncate">
                  {invoice.subject || "—"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatIsoDate(dbDateToIso(invoice.issueDate))}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatIsoDate(dbDateToIso(invoice.dueDate))}
                </TableCell>
                <TableCell>
                  <Amount invoice={invoice} />
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={status(invoice, today)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-2 md:hidden">
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <Link
              href={`/factures/${invoice.id}`}
              className="hover:bg-accent flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <InvoiceNumber invoice={invoice} />
                  <InvoiceStatusBadge status={status(invoice, today)} />
                </div>
                {showClient && <div className="truncate text-sm">{invoice.client.displayName}</div>}
                <div className="text-muted-foreground text-xs">
                  Échéance {formatIsoDate(dbDateToIso(invoice.dueDate))}
                </div>
              </div>
              <Amount invoice={invoice} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
