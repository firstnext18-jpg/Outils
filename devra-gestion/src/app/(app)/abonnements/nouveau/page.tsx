import type { Metadata } from "next";
import { SubscriptionEditor } from "@/app/(app)/abonnements/subscription-editor";
import { PageHeader } from "@/components/page-header";
import { todayIso } from "@/domain/dates";
import { loadDocumentEditorData } from "@/modules/documents/editor-data";
import { db } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouvel abonnement" };

export default async function NewSubscriptionPage({
  searchParams,
}: PageProps<"/abonnements/nouveau">) {
  await requireRole("MEMBER");
  const { client: clientParam } = await searchParams;
  const client =
    typeof clientParam === "string" && /^[0-9a-f-]{36}$/i.test(clientParam)
      ? await db.client.findFirst({
          where: { id: clientParam, archivedAt: null },
          select: { id: true, displayName: true, city: true, language: true, siteTypeId: true },
        })
      : null;
  const { settings, catalog } = await loadDocumentEditorData();
  return (
    <>
      <PageHeader
        title="Nouvel abonnement"
        description="Une facture est générée au début de chaque période, à partir de la date de début."
      />
      <SubscriptionEditor
        initialClient={client}
        catalog={catalog.filter((item) => item.lineType === "SUBSCRIPTION")}
        vatRate={settings.vatEnabled ? (settings.vatRates[0] ?? null) : null}
        defaults={{
          clientId: client?.id ?? "",
          label: "",
          periodicity: "MONTHLY",
          startDate: todayIso(),
          language: client?.language ?? "FR",
          notes: "",
          items: [],
        }}
      />
    </>
  );
}
