import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteActions } from "@/app/(app)/devis/[id]/quote-actions";
import { QuoteBilling } from "@/app/(app)/devis/[id]/quote-billing";
import { LinesTable } from "@/components/documents/lines-table";
import { QuoteStatusBadge } from "@/components/documents/quote-status-badge";
import { EmailHistoryCard } from "@/components/documents/email-history-card";
import { TotalsSummary } from "@/components/documents/totals-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/domain/activity";
import { LANGUAGE_LABELS } from "@/domain/clients";
import { dbDateToIso, formatIsoDate, todayIso } from "@/domain/dates";
import { displayStatus } from "@/domain/invoice-status";
import { canEdit } from "@/domain/roles";
import { formatChf, formatDateTime } from "@/lib/format";
import { listQuoteInvoices } from "@/modules/invoices/service";
import { expireQuotes, getQuote, getQuoteActivity } from "@/modules/quotes/service";
import { storedDocumentTotals } from "@/modules/documents/lines";
import { listEmailLogs, quoteEmailDraft } from "@/modules/emails/service";
import { getSettings } from "@/modules/settings/service";
import { quotePdfFileName } from "@/server/pdf/quote-pdf";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/devis/[id]">): Promise<Metadata> {
  const quote = await getQuote((await params).id);
  return { title: quote ? `Devis ${quote.number}` : "Devis" };
}

export default async function QuotePage({ params }: PageProps<"/devis/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  await expireQuotes();
  const [quote, activity, invoices, emails, settings] = await Promise.all([
    getQuote(id),
    getQuoteActivity(id),
    listQuoteInvoices(id),
    listEmailLogs({ quoteId: id }),
    getSettings(),
  ]);
  if (!quote) notFound();
  const { totals, globalDiscount, deposit } = storedDocumentTotals(quote);
  const today = todayIso();

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link href="/devis" className="text-muted-foreground text-sm hover:underline">
            ← Devis
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Devis {quote.number}</h1>
            <QuoteStatusBadge status={quote.status} />
          </div>
          <p className="text-muted-foreground">
            <Link
              href={`/clients/${quote.client.id}`}
              className="text-foreground font-medium hover:underline"
            >
              {quote.client.displayName}
            </Link>
            {quote.subject && ` · ${quote.subject}`}
          </p>
        </div>
        <QuoteActions
          quote={{ id: quote.id, number: quote.number, status: quote.status }}
          canEdit={canEdit(user.role)}
          email={{
            draft: quoteEmailDraft(quote, settings),
            attachment: quotePdfFileName(quote, settings),
            note:
              quote.status === "DRAFT"
                ? "Après l'envoi, le devis passe au statut « envoyé » et ne peut plus être modifié (sauf en le repassant en brouillon)."
                : undefined,
            senderEmail: user.email,
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lignes</CardTitle>
            </CardHeader>
            <CardContent>
              <LinesTable lines={quote.lines} />
            </CardContent>
          </Card>
          {(quote.introText || quote.conditionsText) && (
            <Card>
              <CardHeader>
                <CardTitle>Textes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {quote.introText && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Introduction
                    </p>
                    <p className="whitespace-pre-wrap">{quote.introText}</p>
                  </div>
                )}
                {quote.conditionsText && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Conditions
                    </p>
                    <p className="whitespace-pre-wrap">{quote.conditionsText}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <EmailHistoryCard logs={emails} />
          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex flex-col sm:flex-row sm:gap-3">
                    <time className="text-muted-foreground shrink-0 tabular-nums sm:w-36">
                      {formatDateTime(entry.createdAt)}
                    </time>
                    <span>
                      <span className="font-medium">{entry.user?.name ?? "Système"}</span>{" "}
                      {describeActivity(entry.action, entry.details)}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {(quote.status === "ACCEPTED" || invoices.length > 0) && (
            <QuoteBilling
              quote={{
                id: quote.id,
                status: quote.status,
                depositCents: quote.depositCents,
                hasOneTimeLines: quote.lines.some((line) => line.lineType !== "SUBSCRIPTION"),
                recurring: totals.recurring.map(
                  (r) =>
                    `${formatChf(r.totalCents)} / ${{ MONTHLY: "mois", QUARTERLY: "trimestre", YEARLY: "an" }[r.periodicity]}`,
                ),
              }}
              invoices={invoices.map((invoice) => ({
                id: invoice.id,
                number: invoice.number,
                type: invoice.type,
                status: invoice.status,
                displayStatus: displayStatus(invoice.status, dbDateToIso(invoice.dueDate), today),
                amountDueCents: invoice.amountDueCents,
              }))}
              canEdit={canEdit(user.role)}
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle>Montants</CardTitle>
            </CardHeader>
            <CardContent>
              <TotalsSummary
                totals={totals}
                globalDiscount={globalDiscount}
                deposit={deposit}
                vatEnabled={quote.vatEnabled}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{formatIsoDate(dbDateToIso(quote.issueDate))}</dd>
                <dt className="text-muted-foreground">Valable jusqu&apos;au</dt>
                <dd>{formatIsoDate(dbDateToIso(quote.validUntil))}</dd>
                <dt className="text-muted-foreground">Langue</dt>
                <dd>{LANGUAGE_LABELS[quote.language]}</dd>
                {quote.siteType && (
                  <>
                    <dt className="text-muted-foreground">Type de site</dt>
                    <dd>{quote.siteType.name}</dd>
                  </>
                )}
                {quote.sentAt && (
                  <>
                    <dt className="text-muted-foreground">Envoyé le</dt>
                    <dd>{formatDateTime(quote.sentAt)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Créé par</dt>
                <dd>{quote.createdBy?.name ?? "—"}</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
