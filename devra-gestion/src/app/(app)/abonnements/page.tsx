import type { Metadata } from "next";
import { FilePlusIcon, RepeatIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { SubscriptionsToolbar } from "@/app/(app)/abonnements/subscriptions-toolbar";
import { SubscriptionsList } from "@/components/documents/subscriptions-list";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { canEdit } from "@/domain/roles";
import { formatChf } from "@/lib/format";
import { subscriptionListParamsSchema } from "@/modules/subscriptions/schemas";
import { listSubscriptions, subscriptionRevenue } from "@/modules/subscriptions/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Abonnements" };

export default async function SubscriptionsPage({ searchParams }: PageProps<"/abonnements">) {
  const user = await requireUser();
  const params = subscriptionListParamsSchema.parse(await searchParams);
  const [subscriptions, revenue, all] = await Promise.all([
    listSubscriptions(params),
    subscriptionRevenue(),
    listSubscriptions({}),
  ]);
  const newButton = canEdit(user.role) && (
    <Button asChild>
      <Link href="/abonnements/nouveau">
        <FilePlusIcon /> Nouvel abonnement
      </Link>
    </Button>
  );

  if (all.length === 0) {
    return (
      <>
        <PageHeader title="Abonnements" />
        <EmptyState
          icon={RepeatIcon}
          title="Aucun abonnement pour l'instant"
          description="Créez un abonnement depuis un devis accepté qui contient des prestations récurrentes, ou directement ici. Ses factures sont générées automatiquement."
          action={newButton}
        />
      </>
    );
  }

  const active = all.filter((s) => s.status === "ACTIVE").length;
  return (
    <>
      <PageHeader
        title="Abonnements"
        description={`${active} actif${active > 1 ? "s" : ""} sur ${all.length}`}
        actions={newButton}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["Revenu récurrent mensuel (MRR, HT)", revenue.mrrCents],
            ["Revenu récurrent annuel (HT)", revenue.arrCents],
          ] as const
        ).map(([label, cents]) => (
          <Card key={label} className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardDescription>{label}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 text-2xl font-semibold tabular-nums">
              {formatChf(cents)}
            </CardContent>
          </Card>
        ))}
      </div>
      <SubscriptionsToolbar />
      {subscriptions.length > 0 ? (
        <SubscriptionsList subscriptions={subscriptions} />
      ) : (
        <EmptyState
          icon={SearchXIcon}
          title="Aucun abonnement ne correspond"
          description="Modifiez le filtre."
        />
      )}
    </>
  );
}
