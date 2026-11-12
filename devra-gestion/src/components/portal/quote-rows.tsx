import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { documentDate, labelled } from "@/components/portal/format";
import { QuoteStateBadge } from "@/components/portal/status-badges";
import { documentLabels } from "@/i18n/documents";
import type { PortalLanguage, PortalTexts } from "@/i18n/portal";
import { formatChf } from "@/lib/format";
import type { PortalQuoteRow } from "@/modules/portal/service";

/** Devis du client : un lien vers chacun (détail, PDF, réponse en ligne). */
export function QuoteRows({
  quotes,
  t,
  language,
}: {
  quotes: PortalQuoteRow[];
  t: PortalTexts;
  language: PortalLanguage;
}) {
  const labels = documentLabels(language);
  return (
    <ul className="divide-y rounded-md border" aria-label={t.navQuotes}>
      {quotes.map((quote) => {
        const recurring = [
          [quote.recurringMonthlyCents, labels.perMonth],
          [quote.recurringQuarterlyCents, labels.perQuarter],
          [quote.recurringYearlyCents, labels.perYear],
        ] as const;
        return (
          <li key={quote.id}>
            <Link
              href={`/espace-client/devis/${quote.id}`}
              className="hover:bg-muted/50 flex items-center gap-3 p-3 text-sm transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {labels.quote} {quote.number}
                  </span>
                  <QuoteStateBadge state={quote.state} t={t} />
                </div>
                {quote.subject && <p className="text-muted-foreground truncate">{quote.subject}</p>}
                <p className="text-muted-foreground text-xs">
                  {labelled(language, t.date)} {documentDate(quote.issueDate)} ·{" "}
                  {labelled(language, t.validUntil)} {documentDate(quote.validUntil)}
                </p>
              </div>
              <div className="text-right">
                <div className="font-semibold whitespace-nowrap tabular-nums">
                  {formatChf(quote.totalCents)}
                </div>
                {recurring
                  .filter(([cents]) => cents > 0)
                  .map(([cents, label]) => (
                    <div
                      key={label}
                      className="text-muted-foreground text-xs whitespace-nowrap tabular-nums"
                    >
                      + {formatChf(cents)} {label}
                    </div>
                  ))}
              </div>
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
