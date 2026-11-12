import { documentDate, periodicityLabel } from "@/components/portal/format";
import { SubscriptionStatusBadge } from "@/components/portal/status-badges";
import { fillLabel } from "@/i18n/documents";
import type { PortalTexts } from "@/i18n/portal";
import { formatChf } from "@/lib/format";
import type { PortalSubscriptionRow } from "@/modules/portal/service";

/** Abonnements du client : montant par période, prochaine facture ou date de résiliation. */
export function SubscriptionRows({
  subscriptions,
  t,
  vatEnabled,
}: {
  subscriptions: PortalSubscriptionRow[];
  t: PortalTexts;
  /** Montants hors TVA : la mention n'est utile que si l'entreprise y est assujettie. */
  vatEnabled: boolean;
}) {
  return (
    <ul className="divide-y rounded-md border" aria-label={t.navSubscriptions}>
      {subscriptions.map((s) => (
        <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.label}</span>
              <SubscriptionStatusBadge status={s.status} t={t} />
            </div>
            <p className="text-muted-foreground text-xs">
              {periodicityLabel(s.periodicity, t)} ·{" "}
              {fillLabel(t.since, { date: documentDate(s.startDate) })}
              {s.status === "ACTIVE" &&
                ` · ${fillLabel(t.nextInvoice, { date: documentDate(s.nextBillingDate) })}`}
              {s.status === "CANCELLED" &&
                s.endDate &&
                ` · ${fillLabel(t.endedOn, { date: documentDate(s.endDate) })}`}
            </p>
          </div>
          <div className="text-right">
            <div className="font-semibold whitespace-nowrap tabular-nums">
              {formatChf(s.amountCents)}
            </div>
            <div className="text-muted-foreground text-xs">
              {t.perPeriod}
              {vatEnabled && `, ${t.exclVat}`}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
