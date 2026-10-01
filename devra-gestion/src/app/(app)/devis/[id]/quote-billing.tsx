"use client";

import { ReceiptTextIcon, RepeatIcon } from "lucide-react";
import { QuoteSubscriptionButton } from "@/app/(app)/devis/[id]/quote-subscription-button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { InvoiceStatusBadge } from "@/components/documents/invoice-status-badge";
import { SubscriptionStatusBadge } from "@/components/documents/subscription-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  INVOICE_TYPE_LABELS,
  type InvoiceDisplayStatus,
  type InvoiceStatus,
  type InvoiceType,
} from "@/domain/invoice-status";
import type { QuoteStatus } from "@/domain/quote-status";
import type { SubscriptionStatus } from "@/domain/subscriptions";
import { formatChf } from "@/lib/format";
import { createInvoiceFromQuoteAction } from "@/modules/invoices/actions";

export type QuoteInvoiceRow = {
  id: string;
  number: string | null;
  type: InvoiceType;
  status: InvoiceStatus;
  displayStatus: InvoiceDisplayStatus;
  amountDueCents: number;
};

/**
 * Facturation d'un devis accepté, en un clic : facture simple, ou facture
 * d'acompte puis facture finale. Les abonnements ne sont pas repris.
 */
export function QuoteBilling({
  quote,
  invoices,
  subscriptions,
  canEdit,
}: {
  quote: {
    id: string;
    status: QuoteStatus;
    depositCents: number;
    hasOneTimeLines: boolean;
    /** Ex. « CHF 29.00 / mois » ; vide sans abonnement. */
    recurring: string[];
  };
  invoices: QuoteInvoiceRow[];
  subscriptions: { id: string; label: string; status: SubscriptionStatus }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const active = invoices.filter((invoice) => invoice.status !== "CANCELLED");
  const deposit = active.find((invoice) => invoice.type === "DEPOSIT");
  const main = active.find((invoice) => invoice.type === "STANDARD" || invoice.type === "FINAL");

  function create(kind: "STANDARD" | "DEPOSIT" | "FINAL") {
    startTransition(async () => {
      const result = await createInvoiceFromQuoteAction({ quoteId: quote.id, kind });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        kind === "DEPOSIT"
          ? "Facture d'acompte créée (brouillon)."
          : kind === "FINAL"
            ? "Facture finale créée (brouillon)."
            : "Facture créée (brouillon).",
      );
      router.push(`/factures/${result.data.id}`);
    });
  }

  let action: React.ReactNode = null;
  let hint: string | null = null;
  if (quote.status === "ACCEPTED" && canEdit && quote.hasOneTimeLines) {
    if (quote.depositCents > 0) {
      if (!deposit) {
        action = (
          <Button className="w-full" onClick={() => create("DEPOSIT")} disabled={pending}>
            <ReceiptTextIcon /> Créer la facture d&apos;acompte
          </Button>
        );
      } else if (deposit.status === "DRAFT") {
        hint = "Émettez la facture d'acompte pour pouvoir créer ensuite la facture finale.";
      } else if (!main) {
        action = (
          <Button className="w-full" onClick={() => create("FINAL")} disabled={pending}>
            <ReceiptTextIcon /> Créer la facture finale
          </Button>
        );
      }
    } else if (!main) {
      action = (
        <Button className="w-full" onClick={() => create("STANDARD")} disabled={pending}>
          <ReceiptTextIcon /> Créer la facture
        </Button>
      );
    }
  }
  if (quote.status !== "ACCEPTED" && invoices.length === 0) {
    hint = "Une fois le devis accepté, il se convertit en facture en un clic.";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {invoices.length > 0 && (
          <ul className="space-y-2">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-2">
                <Link href={`/factures/${invoice.id}`} className="min-w-0 hover:underline">
                  <span className="block truncate font-medium">
                    {invoice.number ?? "Brouillon"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {INVOICE_TYPE_LABELS[invoice.type]} · {formatChf(invoice.amountDueCents)}
                  </span>
                </Link>
                <InvoiceStatusBadge status={invoice.displayStatus} />
              </li>
            ))}
          </ul>
        )}
        {action}
        {hint && <p className="text-muted-foreground">{hint}</p>}
        {quote.recurring.length > 0 && quote.status === "ACCEPTED" && (
          <p className="text-muted-foreground text-xs">
            Les abonnements ({quote.recurring.join(", ")}) ne sont pas repris dans la facture : ils
            sont facturés par un abonnement.
          </p>
        )}
        {subscriptions.length > 0 && (
          <ul className="space-y-1 border-t pt-3">
            {subscriptions.map((subscription) => (
              <li key={subscription.id} className="flex items-center justify-between gap-2">
                <Link href={`/abonnements/${subscription.id}`} className="truncate hover:underline">
                  <RepeatIcon className="mr-1 inline size-3.5" />
                  {subscription.label}
                </Link>
                <SubscriptionStatusBadge status={subscription.status} />
              </li>
            ))}
          </ul>
        )}
        {canEdit &&
          quote.status === "ACCEPTED" &&
          quote.recurring.length > 0 &&
          !subscriptions.some((s) => s.status !== "CANCELLED") && (
            <QuoteSubscriptionButton quoteId={quote.id} />
          )}
        {quote.status === "ACCEPTED" && !quote.hasOneTimeLines && (
          <p className="text-muted-foreground">
            Ce devis ne contient que des abonnements : rien à facturer en une fois.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
