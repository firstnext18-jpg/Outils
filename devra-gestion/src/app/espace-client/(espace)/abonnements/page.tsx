import type { Metadata } from "next";
import { SubscriptionRows } from "@/components/portal/subscription-rows";
import { portalTexts } from "@/i18n/portal";
import { portalSubscriptions } from "@/modules/portal/service";
import { getSettings } from "@/modules/settings/service";
import { requirePortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Abonnements · Abonnemente" };

export default async function PortalSubscriptionsPage() {
  const { client } = await requirePortalSession();
  const t = portalTexts(client.language);
  const [subscriptions, settings] = await Promise.all([
    portalSubscriptions(client.id),
    getSettings(),
  ]);
  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.navSubscriptions}</h1>
        <p className="text-muted-foreground text-sm">{t.subscriptionsHelp}</p>
      </div>
      {subscriptions.length > 0 ? (
        <SubscriptionRows subscriptions={subscriptions} t={t} vatEnabled={settings.vatEnabled} />
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          {t.noSubscriptions}
        </p>
      )}
    </>
  );
}
