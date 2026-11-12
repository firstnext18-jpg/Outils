import type { Metadata } from "next";
import { MessagesSquareIcon } from "lucide-react";
import Link from "next/link";
import { InvoiceRows } from "@/components/portal/invoice-rows";
import { QuoteRows } from "@/components/portal/quote-rows";
import { SubscriptionRows } from "@/components/portal/subscription-rows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fillLabel } from "@/i18n/documents";
import { portalTexts } from "@/i18n/portal";
import { formatChf } from "@/lib/format";
import {
  invoicesToPay,
  portalInvoices,
  portalQuotes,
  portalSubscriptions,
  portalUnreadCount,
} from "@/modules/portal/service";
import { getSettings } from "@/modules/settings/service";
import { requirePortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Espace client · Kundenportal" };

/** Accueil : ce qui est à payer, les devis qui attendent une réponse, les messages. */
export default async function PortalHomePage() {
  const session = await requirePortalSession();
  const { client } = session;
  const language = client.language;
  const t = portalTexts(language);
  const [invoices, quotes, subscriptions, unread, settings] = await Promise.all([
    portalInvoices(client.id),
    portalQuotes(client.id),
    portalSubscriptions(client.id),
    portalUnreadCount(client.id),
    getSettings(),
  ]);
  const toPay = invoicesToPay(invoices);
  const totalToPay = toPay.reduce((sum, invoice) => sum + invoice.outstandingCents, 0);
  const waiting = quotes.filter((quote) => quote.state === "open");
  const active = subscriptions.filter((s) => s.status !== "CANCELLED");
  const name =
    client.kind === "COMPANY" ? client.contactName || client.displayName : client.displayName;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{fillLabel(t.welcome, { name })}</h1>

      {unread > 0 && (
        <Card className="py-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-4">
            <p className="flex items-center gap-2 font-medium">
              <MessagesSquareIcon className="size-5" />
              {unread === 1 ? t.newMessagesOne : fillLabel(t.newMessagesMany, { count: unread })}
            </p>
            <Button asChild size="sm">
              <Link href="/espace-client/discussion">{t.readMessages}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle>{t.toPayTitle}</CardTitle>
            {toPay.length > 0 && <CardDescription>{t.payHelp}</CardDescription>}
          </div>
          {toPay.length > 0 && (
            <div className="text-right">
              <div className="text-muted-foreground text-xs">{t.toPayTotal}</div>
              <div className="text-xl font-semibold tabular-nums">{formatChf(totalToPay)}</div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {toPay.length > 0 ? (
            <InvoiceRows invoices={toPay} t={t} language={language} toPay />
          ) : (
            <p className="text-muted-foreground text-sm">{t.nothingToPay}</p>
          )}
        </CardContent>
      </Card>

      {waiting.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t.quotesWaiting}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteRows quotes={waiting} t={t} language={language} />
          </CardContent>
        </Card>
      )}

      {active.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>{t.activeSubscriptions}</CardTitle>
            <Link href="/espace-client/abonnements" className="text-sm hover:underline">
              {t.seeAll}
            </Link>
          </CardHeader>
          <CardContent>
            <SubscriptionRows subscriptions={active} t={t} vatEnabled={settings.vatEnabled} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
