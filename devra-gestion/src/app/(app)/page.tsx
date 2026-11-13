import type { Metadata } from "next";
import { FilePlusIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { BarList, ChartLegend } from "@/components/dashboard/bar-list";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PaymentShortcut } from "@/components/dashboard/payment-shortcut";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { FormError } from "@/components/forms/form-error";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRate, relativeChange } from "@/domain/dashboard";
import { formatIsoDate, todayIso } from "@/domain/dates";
import { canEdit } from "@/domain/roles";
import { formatChf } from "@/lib/format";
import { dashboardParamsSchema, periodFromParams } from "@/modules/dashboard/schemas";
import {
  EXPIRING_SOON_DAYS,
  getDashboard,
  openInvoicesForPayment,
  type ZoneRow,
} from "@/modules/dashboard/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Tableau de bord" };

const monthLabel = new Intl.DateTimeFormat("fr-CH", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`;
}

/** Barres « CA facturé » et « clients » d'une zone d'action. */
function zoneRows(rows: ZoneRow[]) {
  const maxRevenue = Math.max(0, ...rows.map((r) => r.revenueCents));
  const maxClients = Math.max(0, ...rows.map((r) => r.clients));
  return rows.map((row) => ({
    key: row.key || "-",
    label: row.label,
    value: formatChf(row.revenueCents),
    detail: plural(row.clients, "client", "clients"),
    bars: [
      { share: maxRevenue ? row.revenueCents / maxRevenue : 0, tone: "chart-1" as const },
      { share: maxClients ? row.clients / maxClients : 0, tone: "chart-2" as const },
    ],
  }));
}

function share(value: number, max: number) {
  return max > 0 ? value / max : 0;
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const today = todayIso();
  const { period, error } = periodFromParams(
    dashboardParamsSchema.parse(await searchParams),
    today,
  );
  const editable = canEdit(user.role);
  const [data, openInvoices] = await Promise.all([
    getDashboard(period, today),
    editable ? openInvoicesForPayment() : Promise.resolve([]),
  ]);
  const { current, previous } = data.revenue;
  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  const maxTopClient = data.topClients[0]?.invoicedCents ?? 0;
  const maxDemanded = Math.max(0, ...data.siteTypes.demanded.map((r) => r.value));
  const maxSold = Math.max(0, ...data.siteTypes.sold.map((r) => r.value));
  const conversion = data.conversion;

  return (
    <>
      <PageHeader
        title={`Bonjour ${firstName}`}
        description="Voici l'essentiel de votre activité."
        actions={
          editable && (
            <>
              <Button asChild>
                <Link href="/devis/nouveau">
                  <FilePlusIcon /> Nouveau devis
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/clients/nouveau">
                  <UserPlusIcon /> Nouveau client
                </Link>
              </Button>
              <PaymentShortcut invoices={openInvoices} />
            </>
          )
        }
      />

      <PeriodFilter period={period} />
      <FormError message={error} />

      <section
        aria-label="Indicateurs"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <KpiCard
          title="Chiffre d'affaires facturé"
          value={formatChf(current.invoicedCents)}
          comparison={{
            change: relativeChange(current.invoicedCents, previous.invoicedCents),
            previous: formatChf(previous.invoicedCents),
          }}
          detail={plural(current.invoiceCount, "facture émise", "factures émises")}
        />
        <KpiCard
          title="Encaissé"
          value={formatChf(current.paidCents)}
          comparison={{
            change: relativeChange(current.paidCents, previous.paidCents),
            previous: formatChf(previous.paidCents),
          }}
          detail="Paiements reçus pendant la période"
        />
        <KpiCard
          title="Dépenses"
          value={formatChf(current.expensesCents)}
          comparison={{
            change: relativeChange(current.expensesCents, previous.expensesCents),
            previous: formatChf(previous.expensesCents),
          }}
          detail={`Résultat (encaissé − dépenses) : ${formatChf(current.resultCents)}`}
          href="/depenses"
        />
        {user.role === "ADMIN" && (
          <KpiCard
            title="Trésorerie estimée"
            value={formatChf(current.cashCents)}
            comparison={{
              change: relativeChange(current.cashCents, previous.cashCents),
              previous: formatChf(previous.cashCents),
            }}
            detail={`Encaissé + apports des associés (${formatChf(current.partnerInCents)}) − dépenses − remboursements (${formatChf(current.partnerOutCents)})`}
            href="/apports"
          />
        )}
        <KpiCard
          title="Factures impayées"
          value={formatChf(data.unpaid.totalCents)}
          detail={
            <>
              {plural(data.unpaid.count, "facture", "factures")}
              {data.unpaid.overdueCount > 0 && (
                <span className="text-destructive">
                  {" "}
                  · dont {data.unpaid.overdueCount} en retard ({formatChf(data.unpaid.overdueCents)}
                  )
                </span>
              )}
            </>
          }
          href="/factures?statut=en-retard"
        />
        <KpiCard
          title="Devis en attente"
          value={formatChf(data.quotes.totalCents)}
          detail={`${plural(data.quotes.count, "devis envoyé", "devis envoyés")} sans réponse${data.quotes.expiringCount > 0 ? ` · ${plural(data.quotes.expiringCount, "expire", "expirent")} dans les ${EXPIRING_SOON_DAYS} jours` : ""}`}
          href="/devis?statut=envoye"
        />
        <KpiCard
          title="Taux de conversion des devis"
          value={conversion.rate === null ? "—" : formatRate(conversion.rate)}
          detail={
            conversion.sent === 0
              ? "Aucun devis envoyé pendant la période"
              : `${plural(conversion.accepted, "accepté", "acceptés")} sur ${plural(conversion.sent, "envoyé", "envoyés")} pendant la période${conversion.pending > 0 ? ` · ${conversion.pending} en attente` : ""}`
          }
        />
        <KpiCard
          title="Revenu récurrent mensuel (MRR, HT)"
          value={formatChf(data.recurring.mrrCents)}
          detail={`${plural(data.recurring.active, "abonnement actif", "abonnements actifs")} · ${formatChf(data.recurring.arrCents)} par an`}
          href="/abonnements"
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Chiffre d&apos;affaires sur 12 mois</CardTitle>
            <CardDescription>Montants facturés et encaissés par mois.</CardDescription>
          </div>
          <ChartLegend
            items={[
              { label: "Facturé", tone: "chart-1" },
              { label: "Encaissé", tone: "chart-2" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <RevenueChart
            data={data.monthly.map((m) => ({
              label: monthLabel.format(new Date(`${m.month}-01T00:00:00Z`)),
              invoicedCents: m.invoicedCents,
              paidCents: m.paidCents,
            }))}
          />
          <table className="sr-only">
            <caption>Chiffre d&apos;affaires des 12 derniers mois</caption>
            <thead>
              <tr>
                <th scope="col">Mois</th>
                <th scope="col">Facturé</th>
                <th scope="col">Encaissé</th>
              </tr>
            </thead>
            <tbody>
              {data.monthly.map((m) => (
                <tr key={m.month}>
                  <th scope="row">{monthLabel.format(new Date(`${m.month}-01T00:00:00Z`))}</th>
                  <td>{formatChf(m.invoicedCents)}</td>
                  <td>{formatChf(m.paidCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle>Factures en retard</CardTitle>
              <CardDescription>
                Échéance dépassée, de la plus ancienne à la plus récente.
              </CardDescription>
            </div>
            {data.unpaid.overdueCount > 0 && (
              <Link
                href="/factures?statut=en-retard"
                className="text-muted-foreground hover:text-foreground shrink-0 text-sm hover:underline"
              >
                Voir tout
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {data.unpaid.overdue.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune facture en retard.</p>
            ) : (
              <ul className="divide-y text-sm" aria-label="Factures en retard">
                {data.unpaid.overdue.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/factures/${invoice.id}`}
                        className="font-medium hover:underline"
                      >
                        {invoice.number}
                      </Link>
                      <span className="text-muted-foreground"> · {invoice.client.displayName}</span>
                      <p className="text-destructive text-xs">
                        Échue le {formatIsoDate(invoice.dueDate)} ·{" "}
                        {plural(invoice.daysLate, "jour", "jours")} de retard
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums">{formatChf(invoice.balanceCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle>Devis qui expirent bientôt</CardTitle>
              <CardDescription>
                Envoyés, sans réponse, valables encore {EXPIRING_SOON_DAYS} jours au plus.
              </CardDescription>
            </div>
            {data.quotes.count > 0 && (
              <Link
                href="/devis?statut=envoye"
                className="text-muted-foreground hover:text-foreground shrink-0 text-sm hover:underline"
              >
                Voir tout
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {data.quotes.expiring.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun devis n&apos;expire bientôt.</p>
            ) : (
              <ul className="divide-y text-sm" aria-label="Devis qui expirent bientôt">
                {data.quotes.expiring.map((quote) => (
                  <li
                    key={quote.id}
                    className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link href={`/devis/${quote.id}`} className="font-medium hover:underline">
                        {quote.number}
                      </Link>
                      <span className="text-muted-foreground"> · {quote.client.displayName}</span>
                      <p className="text-warning text-xs">
                        {quote.daysLeft === 0
                          ? "Expire ce soir"
                          : `Valable jusqu'au ${formatIsoDate(quote.validUntil)} (${plural(quote.daysLeft, "jour", "jours")})`}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums">{formatChf(quote.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Meilleurs clients</CardTitle>
            <CardDescription>Les 5 clients les plus facturés pendant la période.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              label="Meilleurs clients"
              empty="Aucune facture émise pendant la période."
              rows={data.topClients.map((row) => ({
                key: row.client.id,
                label: row.client.displayName,
                href: `/clients/${row.client.id}`,
                value: formatChf(row.invoicedCents),
                detail: plural(row.invoiceCount, "facture", "factures"),
                bars: [{ share: share(row.invoicedCents, maxTopClient), tone: "chart-1" }],
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Types de site</CardTitle>
            <CardDescription>
              Demandés par les clients (fiches actuelles) et vendus pendant la période.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Demandés</h3>
              <BarList
                label="Types de site demandés"
                empty="Aucun client."
                rows={data.siteTypes.demanded.map((row) => ({
                  key: row.key || "-",
                  label: row.label,
                  value: plural(row.value, "client", "clients"),
                  bars: [{ share: share(row.value, maxDemanded), tone: "chart-2" }],
                }))}
              />
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Vendus</h3>
              <BarList
                label="Types de site vendus"
                empty="Aucune facture émise pendant la période."
                rows={data.siteTypes.sold.map((row) => ({
                  key: row.key || "-",
                  label: row.label,
                  value: formatChf(row.value),
                  bars: [{ share: share(row.value, maxSold), tone: "chart-1" }],
                }))}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Zones d&apos;action</CardTitle>
            <CardDescription>
              Chiffre d&apos;affaires facturé pendant la période et nombre de clients, selon
              l&apos;adresse des clients.
            </CardDescription>
          </div>
          <ChartLegend
            items={[
              { label: "CA facturé", tone: "chart-1" },
              { label: "Clients", tone: "chart-2" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="cantons">
            <TabsList>
              <TabsTrigger value="cantons">Cantons</TabsTrigger>
              <TabsTrigger value="localites">Localités</TabsTrigger>
            </TabsList>
            <TabsContent value="cantons" className="pt-4">
              <BarList
                label="Cantons"
                empty="Aucun client pour l'instant."
                rows={zoneRows(data.zones.cantons)}
              />
            </TabsContent>
            <TabsContent value="localites" className="pt-4">
              <BarList
                label="Localités"
                empty="Aucun client pour l'instant."
                rows={zoneRows(data.zones.cities)}
              />
              {data.zones.cities.length === 10 && (
                <p className="text-muted-foreground mt-3 text-xs">Les 10 premières localités.</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
