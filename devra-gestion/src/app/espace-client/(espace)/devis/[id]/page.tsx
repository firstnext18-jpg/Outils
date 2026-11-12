import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OnlineQuoteDocument } from "@/components/documents/online-quote-document";
import { QuoteDecisionForm } from "@/components/documents/quote-decision-form";
import { documentDate } from "@/components/portal/format";
import { Card, CardContent } from "@/components/ui/card";
import { fillLabel } from "@/i18n/documents";
import { onlineQuoteTexts } from "@/i18n/online-quote";
import { portalTexts } from "@/i18n/portal";
import { formatDate } from "@/lib/format";
import { portalQuote } from "@/modules/online-quotes/service";
import { getSettings } from "@/modules/settings/service";
import { requirePortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Devis · Offerte" };

/** Un devis du client : contenu, PDF, et sa réponse (acceptation ou refus) tant qu'il est ouvert. */
export default async function PortalQuotePage({ params }: PageProps<"/espace-client/devis/[id]">) {
  const { client } = await requirePortalSession();
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await portalQuote(client.id, id) : null;
  if (!found) notFound();
  const { quote, state } = found;
  const settings = await getSettings();
  const t = portalTexts(client.language);
  // La réponse se donne dans la langue du devis, comme sur la page en ligne.
  const texts = onlineQuoteTexts(quote.language);
  const validUntil = documentDate(quote.validUntil);
  const decidedOn = quote.decidedAt ? formatDate(quote.decidedAt) : "";

  return (
    <>
      <Link href="/espace-client/devis" className="text-muted-foreground text-sm hover:underline">
        {t.backToQuotes}
      </Link>
      <OnlineQuoteDocument
        quote={quote}
        settings={settings}
        pdfHref={`/api/espace-client/devis/${quote.id}/pdf`}
      />
      <Card lang={quote.language === "DE" ? "de" : "fr"}>
        <CardContent className="py-2 text-sm">
          {state === "open" && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                {fillLabel(texts.validUntilNotice, { date: validUntil })}
              </p>
              <QuoteDecisionForm target={{ quoteId: quote.id }} texts={texts} />
            </div>
          )}
          {state === "accepted" && (
            <p role="status" className="text-success font-medium">
              {quote.decidedOnline
                ? fillLabel(texts.accepted, { date: decidedOn, name: quote.decisionName })
                : texts.acceptedOffline}
            </p>
          )}
          {state === "refused" && (
            <p role="status" className="font-medium">
              {fillLabel(texts.refused, { date: decidedOn })}
            </p>
          )}
          {(state === "expired" || state === "unavailable") && (
            <p role="status" className="font-medium">
              {fillLabel(texts.expired, { date: validUntil })}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
