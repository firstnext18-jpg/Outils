import Link from "next/link";
import { SubscriptionStatusBadge } from "@/components/documents/subscription-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERIODICITY_LABELS, PERIODICITY_UNIT } from "@/domain/catalog";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { UNIT_LABELS } from "@/domain/units";
import { formatChf } from "@/lib/format";
import type { SubscriptionListRow } from "@/modules/subscriptions/service";

function Amount({ subscription }: { subscription: SubscriptionListRow }) {
  const unit = UNIT_LABELS[PERIODICITY_UNIT[subscription.periodicity]].FR.one;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatChf(subscription.amountCents)} / {unit}
    </span>
  );
}

function NextBilling({ subscription }: { subscription: SubscriptionListRow }) {
  return subscription.status === "ACTIVE" ? (
    <span className="tabular-nums">{formatIsoDate(dbDateToIso(subscription.nextBillingDate))}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

/** Liste d'abonnements : tableau sur grand écran, cartes sur téléphone. */
export function SubscriptionsList({
  subscriptions,
  showClient = true,
}: {
  subscriptions: SubscriptionListRow[];
  showClient?: boolean;
}) {
  return (
    <>
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Abonnement</TableHead>
              {showClient && <TableHead>Client</TableHead>}
              <TableHead>Périodicité</TableHead>
              <TableHead className="text-right">Montant (HT)</TableHead>
              <TableHead>Prochaine facture</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((subscription) => (
              <TableRow key={subscription.id} className="relative">
                <TableCell className="max-w-72 truncate pl-4">
                  <Link
                    href={`/abonnements/${subscription.id}`}
                    className="font-medium after:absolute after:inset-0 hover:underline"
                  >
                    {subscription.label}
                  </Link>
                </TableCell>
                {showClient && <TableCell>{subscription.client.displayName}</TableCell>}
                <TableCell>{PERIODICITY_LABELS[subscription.periodicity]}</TableCell>
                <TableCell className="text-right">
                  <Amount subscription={subscription} />
                </TableCell>
                <TableCell>
                  <NextBilling subscription={subscription} />
                </TableCell>
                <TableCell>
                  <SubscriptionStatusBadge status={subscription.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-2 md:hidden">
        {subscriptions.map((subscription) => (
          <li key={subscription.id}>
            <Link
              href={`/abonnements/${subscription.id}`}
              className="hover:bg-accent flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="truncate font-medium">{subscription.label}</div>
                {showClient && (
                  <div className="truncate text-sm">{subscription.client.displayName}</div>
                )}
                <SubscriptionStatusBadge status={subscription.status} />
              </div>
              <div className="text-right text-sm">
                <Amount subscription={subscription} />
                <div className="text-muted-foreground text-xs">
                  <NextBilling subscription={subscription} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
