import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SubscriptionEditor } from "@/app/(app)/abonnements/subscription-editor";
import { PageHeader } from "@/components/page-header";
import { loadDocumentEditorData } from "@/modules/documents/editor-data";
import { subscriptionToInput } from "@/modules/subscriptions/form";
import { getSubscription } from "@/modules/subscriptions/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Modifier l'abonnement" };

export default async function EditSubscriptionPage({
  params,
}: PageProps<"/abonnements/[id]/modifier">) {
  await requireRole("MEMBER");
  const { id } = await params;
  const subscription = await getSubscription(id);
  if (!subscription) notFound();
  if (subscription.status === "CANCELLED") redirect(`/abonnements/${id}`);
  const { settings, catalog } = await loadDocumentEditorData();
  return (
    <>
      <PageHeader
        title={`Modifier « ${subscription.label} »`}
        description="Les changements s'appliquent aux prochaines factures."
      />
      <SubscriptionEditor
        existing={{
          id: subscription.id,
          version: subscription.version,
          billed: subscription.billedPeriods > 0,
        }}
        initialClient={{
          id: subscription.client.id,
          displayName: subscription.client.displayName,
          city: subscription.client.city,
          language: subscription.client.language,
          siteTypeId: subscription.client.siteTypeId,
        }}
        catalog={catalog.filter((item) => item.lineType === "SUBSCRIPTION")}
        vatRate={settings.vatEnabled ? (settings.vatRates[0] ?? null) : null}
        defaults={subscriptionToInput(subscription)}
      />
    </>
  );
}
