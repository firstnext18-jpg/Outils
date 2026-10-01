import Link from "next/link";
import { QuoteStatusBadge } from "@/components/documents/quote-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { formatChf } from "@/lib/format";
import type { QuoteListRow } from "@/modules/quotes/service";

/** « CHF 1'490.00 + CHF 29.00 / mois » */
function Amount({ quote }: { quote: QuoteListRow }) {
  const recurring = [
    [quote.recurringMonthlyCents, "mois"],
    [quote.recurringQuarterlyCents, "trimestre"],
    [quote.recurringYearlyCents, "an"],
  ].filter(([cents]) => (cents as number) > 0) as [number, string][];
  return (
    <div className="text-right tabular-nums">
      {(quote.totalCents > 0 || recurring.length === 0) && (
        <div className="font-medium">{formatChf(quote.totalCents)}</div>
      )}
      {recurring.map(([cents, unit]) => (
        <div key={unit} className="text-muted-foreground text-xs">
          + {formatChf(cents)} / {unit}
        </div>
      ))}
    </div>
  );
}

/** Liste de devis : tableau sur grand écran, cartes sur téléphone. */
export function QuotesList({
  quotes,
  showClient = true,
}: {
  quotes: QuoteListRow[];
  showClient?: boolean;
}) {
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
              <TableHead>Validité</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => (
              <TableRow key={quote.id} className="relative">
                <TableCell className="pl-4">
                  <Link
                    href={`/devis/${quote.id}`}
                    className="font-medium tabular-nums after:absolute after:inset-0 hover:underline"
                  >
                    {quote.number}
                  </Link>
                </TableCell>
                {showClient && <TableCell>{quote.client.displayName}</TableCell>}
                <TableCell className="text-muted-foreground max-w-56 truncate">
                  {quote.subject || "—"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatIsoDate(dbDateToIso(quote.issueDate))}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatIsoDate(dbDateToIso(quote.validUntil))}
                </TableCell>
                <TableCell>
                  <Amount quote={quote} />
                </TableCell>
                <TableCell>
                  <QuoteStatusBadge status={quote.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-2 md:hidden">
        {quotes.map((quote) => (
          <li key={quote.id}>
            <Link
              href={`/devis/${quote.id}`}
              className="hover:bg-accent flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{quote.number}</span>
                  <QuoteStatusBadge status={quote.status} />
                </div>
                {showClient && <div className="truncate text-sm">{quote.client.displayName}</div>}
                <div className="text-muted-foreground text-xs">
                  {formatIsoDate(dbDateToIso(quote.issueDate))}
                </div>
              </div>
              <Amount quote={quote} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
