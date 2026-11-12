import { Badge } from "@/components/ui/badge";
import type { InvoiceDisplayStatus } from "@/domain/invoice-status";
import type { OnlineQuoteState } from "@/domain/online-quote";
import type { SubscriptionStatus } from "@/domain/subscriptions";
import type { PortalTexts } from "@/i18n/portal";

/** Statuts affichés dans l'espace client, dans la langue du client. */

export function QuoteStateBadge({ state, t }: { state: OnlineQuoteState; t: PortalTexts }) {
  switch (state) {
    case "open":
      return <Badge>{t.quoteSent}</Badge>;
    case "accepted":
      return <Badge variant="secondary">{t.quoteAccepted}</Badge>;
    case "refused":
      return <Badge variant="outline">{t.quoteRefused}</Badge>;
    default:
      return <Badge variant="outline">{t.quoteExpired}</Badge>;
  }
}

export function InvoiceStatusBadge({
  status,
  t,
}: {
  status: InvoiceDisplayStatus;
  t: PortalTexts;
}) {
  switch (status) {
    case "OVERDUE":
      return <Badge variant="destructive">{t.invoiceOverdue}</Badge>;
    case "PAID":
      return <Badge variant="secondary">{t.invoicePaid}</Badge>;
    case "PARTIALLY_PAID":
      return <Badge>{t.invoicePartiallyPaid}</Badge>;
    case "CANCELLED":
      return <Badge variant="outline">{t.invoiceCancelled}</Badge>;
    default:
      return <Badge>{t.invoiceOpen}</Badge>;
  }
}

export function SubscriptionStatusBadge({
  status,
  t,
}: {
  status: SubscriptionStatus;
  t: PortalTexts;
}) {
  if (status === "ACTIVE") return <Badge variant="secondary">{t.subscriptionActive}</Badge>;
  if (status === "PAUSED") return <Badge variant="outline">{t.subscriptionPaused}</Badge>;
  return <Badge variant="outline">{t.subscriptionCancelled}</Badge>;
}
