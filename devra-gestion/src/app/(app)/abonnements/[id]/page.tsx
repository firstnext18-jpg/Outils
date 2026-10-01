import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubscriptionActions } from "@/app/(app)/abonnements/[id]/subscription-actions";
import { InvoicesList } from "@/components/documents/invoices-list";
import { SubscriptionStatusBadge } from "@/components/documents/subscription-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/domain/activity";
import { PERIODICITY_LABELS, PERIODICITY_UNIT } from "@/domain/catalog";
import { LANGUAGE_LABELS } from "@/domain/clients";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { formatPercent } from "@/domain/percent";
import { formatQuantity } from "@/domain/quantity";
import { canEdit } from "@/domain/roles";
import { UNIT_LABELS } from "@/domain/units";
import { formatChf, formatDateTime } from "@/lib/format";
import { periodAmount } from "@/modules/subscriptions/amounts";
import { getSubscription, getSubscriptionActivity } from "@/modules/subscriptions/service";
import { requireUser } from "@/server/session";

export async function generateMetadata({
  params,
}: PageProps<"/abonnements/[id]">): Promise<Metadata> {
  const subscription = await getSubscription((await params).id);
  return { title: subscription ? `Abonnement « ${subscription.label} »` : "Abonnement" };
}

export default async function SubscriptionPage({ params }: PageProps<"/abonnements/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [subscription, activity] = await Promise.all([
    getSubscription(id),
    getSubscriptionActivity(id),
  ]);
  if (!subscription) notFound();
  const unit = UNIT_LABELS[PERIODICITY_UNIT[subscription.periodicity]].FR.one;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link href="/abonnements" className="text-muted-foreground text-sm hover:underline">
            ← Abonnements
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{subscription.label}</h1>
            <SubscriptionStatusBadge status={subscription.status} />
          </div>
          <p className="text-muted-foreground">
            <Link
              href={`/clients/${subscription.client.id}`}
              className="text-foreground font-medium hover:underline"
            >
              {subscription.client.displayName}
            </Link>
            {` · ${PERIODICITY_LABELS[subscription.periodicity].toLowerCase()}`}
          </p>
        </div>
        {canEdit(user.role) && (
          <SubscriptionActions
            subscription={{
              id: subscription.id,
              label: subscription.label,
              status: subscription.status,
              invoiced: subscription.invoices.length > 0,
            }}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prestations facturées chaque {unit}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {subscription.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-4 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{item.label}</p>
                      {item.description && (
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {formatQuantity(item.quantityMilli)} × {formatChf(item.unitPriceCents)}
                        {item.discountType &&
                          item.discountValue > 0 &&
                          ` − ${item.discountType === "PERCENT" ? formatPercent(item.discountValue) : formatChf(item.discountValue)}`}
                      </p>
                    </div>
                    <span className="font-medium whitespace-nowrap tabular-nums">
                      {formatChf(periodAmount([item]))}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Factures générées</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {subscription.invoices.length > 0 ? (
                <InvoicesList invoices={subscription.invoices} showClient={false} />
              ) : (
                <p className="text-muted-foreground">
                  Aucune facture pour l&apos;instant : la première sera générée le{" "}
                  {formatIsoDate(dbDateToIso(subscription.nextBillingDate))}.
                </p>
              )}
            </CardContent>
          </Card>
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
          <Card>
            <CardHeader>
              <CardTitle>Montant</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {formatChf(subscription.amountCents)}
                <span className="text-muted-foreground text-base font-normal"> / {unit}</span>
              </p>
              <p className="text-muted-foreground text-xs">Hors TVA</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Début</dt>
                <dd>{formatIsoDate(dbDateToIso(subscription.startDate))}</dd>
                {subscription.status === "ACTIVE" && (
                  <>
                    <dt className="text-muted-foreground">Prochaine facture</dt>
                    <dd>{formatIsoDate(dbDateToIso(subscription.nextBillingDate))}</dd>
                  </>
                )}
                {subscription.pausedAt && subscription.status === "PAUSED" && (
                  <>
                    <dt className="text-muted-foreground">En pause depuis</dt>
                    <dd>{formatDateTime(subscription.pausedAt)}</dd>
                  </>
                )}
                {subscription.endDate && (
                  <>
                    <dt className="text-muted-foreground">Résilié le</dt>
                    <dd>{formatIsoDate(dbDateToIso(subscription.endDate))}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Périodes facturées</dt>
                <dd>{subscription.billedPeriods}</dd>
                <dt className="text-muted-foreground">Langue</dt>
                <dd>{LANGUAGE_LABELS[subscription.language]}</dd>
                {subscription.quote && (
                  <>
                    <dt className="text-muted-foreground">Devis</dt>
                    <dd>
                      <Link href={`/devis/${subscription.quote.id}`} className="hover:underline">
                        {subscription.quote.number}
                      </Link>
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Créé par</dt>
                <dd>{subscription.createdBy?.name ?? "—"}</dd>
              </dl>
              {subscription.notes && (
                <p className="text-muted-foreground mt-4 text-sm whitespace-pre-wrap">
                  {subscription.notes}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
