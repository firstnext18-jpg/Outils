import type { Metadata } from "next";
import { OnlineQuoteDocument } from "@/components/documents/online-quote-document";
import { QuoteDecisionForm } from "@/components/documents/quote-decision-form";
import { Card, CardContent } from "@/components/ui/card";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { fillLabel } from "@/i18n/documents";
import { onlineQuoteTexts } from "@/i18n/online-quote";
import { quoteForToken } from "@/modules/online-quotes/service";
import { companySnapshot, type CompanySnapshot } from "@/modules/settings/documents";
import { getSettings } from "@/modules/settings/service";

// Le lien ne doit fuiter ni vers d'autres sites ni dans un moteur de recherche.
export const metadata: Metadata = {
  title: "Devis · Offerte",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function OnlineQuotePage({ params }: PageProps<"/devis-en-ligne/[token]">) {
  const { token } = await params;
  const found = await quoteForToken(token);
  if (!found) {
    const fr = onlineQuoteTexts("FR");
    const de = onlineQuoteTexts("DE");
    return (
      <Card>
        <CardContent className="space-y-4 py-6 text-sm">
          <div lang="fr" className="space-y-1">
            <h1 className="text-lg font-semibold">{fr.notFoundTitle}</h1>
            <p className="text-muted-foreground">{fr.notFoundText}</p>
          </div>
          <div lang="de" className="space-y-1">
            <h2 className="text-lg font-semibold">{de.notFoundTitle}</h2>
            <p className="text-muted-foreground">{de.notFoundText}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { quote, state } = found;
  const settings = await getSettings();
  const language = quote.language;
  const lang = language === "DE" ? "de" : "fr";
  const texts = onlineQuoteTexts(language);
  const company = (quote.companySnapshot as CompanySnapshot | null) ?? companySnapshot(settings);
  const validUntil = formatIsoDate(dbDateToIso(quote.validUntil));
  const decidedOn = quote.decidedAt
    ? quote.decidedAt.toLocaleDateString("de-CH", {
        timeZone: "Europe/Zurich",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
  const contact = [company.email, company.phone].filter(Boolean).join(" · ");

  return (
    <div lang={lang} className="space-y-6">
      <OnlineQuoteDocument
        quote={quote}
        settings={settings}
        pdfHref={`/api/devis-en-ligne/${token}/pdf`}
      />

      <Card>
        <CardContent className="py-2 text-sm">
          {state === "open" && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                {fillLabel(texts.validUntilNotice, { date: validUntil })}
              </p>
              <QuoteDecisionForm target={{ token }} texts={texts} />
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
          {state === "expired" && (
            <p role="status" className="font-medium">
              {fillLabel(texts.expired, { date: validUntil })}
            </p>
          )}
          {state === "unavailable" && (
            <p role="status" className="font-medium">
              {texts.unavailable}
            </p>
          )}
          {contact && (
            <p className="text-muted-foreground mt-4 text-xs">
              {fillLabel(texts.contact, { contact })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
