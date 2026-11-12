import type { Metadata } from "next";
import { QuoteRows } from "@/components/portal/quote-rows";
import { portalTexts } from "@/i18n/portal";
import { portalQuotes } from "@/modules/portal/service";
import { requirePortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Devis · Offerten" };

export default async function PortalQuotesPage() {
  const { client } = await requirePortalSession();
  const t = portalTexts(client.language);
  const quotes = await portalQuotes(client.id);
  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.navQuotes}</h1>
        <p className="text-muted-foreground text-sm">{t.quotesHelp}</p>
      </div>
      {quotes.length > 0 ? (
        <QuoteRows quotes={quotes} t={t} language={client.language} />
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          {t.noQuotes}
        </p>
      )}
    </>
  );
}
