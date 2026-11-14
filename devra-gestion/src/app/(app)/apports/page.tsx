import type { Metadata } from "next";
import { HandCoinsIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import {
  isIncoming,
  PARTNER_KIND_LABELS,
  type CompanyFunds,
  type PartnerBalance,
} from "@/domain/partners";
import { formatChf } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  currentCompanyFunds,
  listPartnerMovements,
  partnerSummaries,
} from "@/modules/partners/service";
import { displayCompanyName, getSettings } from "@/modules/settings/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Apports des associés" };

function BalanceLines({ balance }: { balance: PartnerBalance }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">Capital apporté</dt>
      <dd className="text-right tabular-nums">{formatChf(balance.capitalCents)}</dd>
      <dt className="text-muted-foreground">Prêt à rembourser</dt>
      <dd className="text-right tabular-nums">{formatChf(balance.loanCents)}</dd>
      <dt className="text-muted-foreground">Déjà rendu</dt>
      <dd className="text-right tabular-nums">{formatChf(balance.outCents)}</dd>
      <dt className="font-medium">Investi au total</dt>
      <dd className="text-right font-semibold tabular-nums">
        {formatChf(balance.capitalCents + balance.loanCents)}
      </dd>
    </dl>
  );
}

/** Fonds de l'entreprise depuis le début, avec le détail du calcul. */
function FundsCard({ funds, companyName }: { funds: CompanyFunds; companyName: string }) {
  const lines: [string, number][] = [
    ["Encaissé (paiements des clients)", funds.paidCents],
    ["Apports des associés", funds.partnerInCents],
    ["Dépenses (salaires compris)", -funds.expensesCents],
    ["Rendu aux associés", -funds.partnerOutCents],
  ];
  return (
    <section aria-label="Fonds de l'entreprise">
      <Card>
        <CardHeader>
          <CardDescription>Fonds de {companyName}</CardDescription>
          <CardTitle
            data-testid="fonds-total"
            className={cn("text-3xl tabular-nums", funds.totalCents < 0 && "text-destructive")}
          >
            {formatChf(funds.totalCents)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            {lines.map(([label, cents]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right tabular-nums">
                  {cents < 0 ? "−" : "+"} {formatChf(Math.abs(cents))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground text-xs">
            Depuis le début, d&apos;après les paiements, les apports et les dépenses enregistrés
            dans l&apos;outil. Un salaire versé se saisit comme une dépense : il est alors retiré
            des fonds.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

/** Argent mis par les associés dans l'entreprise, et ce qu'elle leur a rendu (admins). */
export default async function PartnersPage() {
  await requireRole("ADMIN");
  const [{ partners, total }, movements, funds, settings] = await Promise.all([
    partnerSummaries(),
    listPartnerMovements(),
    currentCompanyFunds(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Apports des associés"
        description="Argent investi par les associés (capital, prêts) et ce que l'entreprise leur a rendu. Visible par les admins seulement."
        actions={
          <Button asChild>
            <Link href="/apports/nouveau">
              <PlusIcon /> Nouveau mouvement
            </Link>
          </Button>
        }
      />

      <FundsCard funds={funds} companyName={displayCompanyName(settings)} />

      {movements.length === 0 ? (
        <EmptyState
          icon={HandCoinsIcon}
          title="Aucun apport pour l'instant"
          description="Enregistrez l'argent qu'un associé met dans l'entreprise (apport en capital ou prêt), puis les remboursements."
        />
      ) : (
        <>
          <section
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Soldes des associés"
          >
            {partners.map((partner) => (
              <Card key={partner.id} className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-base">{partner.name}</CardTitle>
                  {!partner.active && <CardDescription>Compte désactivé</CardDescription>}
                </CardHeader>
                <CardContent className="px-4">
                  <BalanceLines balance={partner.balance} />
                </CardContent>
              </Card>
            ))}
            {partners.length > 1 && (
              <Card className="bg-muted/40 gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-base">Tous les associés</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <BalanceLines balance={total} />
                </CardContent>
              </Card>
            )}
          </section>

          <ul className="divide-y rounded-md border" aria-label="Mouvements">
            {movements.map((m) => {
              const incoming = isIncoming(m.kind);
              return (
                <li key={m.id}>
                  <Link
                    href={`/apports/${m.id}`}
                    className="hover:bg-muted/50 flex flex-wrap items-center gap-3 p-3 text-sm transition-colors"
                  >
                    <span className="text-muted-foreground w-24 tabular-nums">
                      {formatIsoDate(dbDateToIso(m.date))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{m.partner.name}</span>
                      {m.description && (
                        <span className="text-muted-foreground"> · {m.description}</span>
                      )}
                      {m._count.receipts > 0 && (
                        <PaperclipIcon
                          className="text-muted-foreground ml-1 inline size-3.5"
                          aria-label="Justificatif joint"
                        />
                      )}
                    </span>
                    <Badge variant={incoming ? "secondary" : "outline"}>
                      {PARTNER_KIND_LABELS[m.kind]}
                    </Badge>
                    <span
                      className={cn(
                        "w-32 text-right font-medium tabular-nums",
                        incoming ? "text-success" : "text-foreground",
                      )}
                    >
                      {incoming ? "+" : "−"} {formatChf(m.amountCents)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
