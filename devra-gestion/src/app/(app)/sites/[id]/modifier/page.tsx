import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteForm } from "@/app/(app)/sites/site-form";
import { dbDateToIso } from "@/domain/dates";
import { getSite } from "@/modules/sites/service";
import { db } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Modifier le site" };

export default async function EditSitePage({ params }: PageProps<"/sites/[id]/modifier">) {
  await requireRole("MEMBER");
  const { id } = await params;
  const site = /^[0-9a-f-]{36}$/i.test(id) ? await getSite(id) : null;
  if (!site) notFound();
  const client = await db.client.findUnique({
    where: { id: site.clientId },
    select: { id: true, displayName: true, city: true, language: true, siteTypeId: true },
  });
  return (
    <>
      <div className="space-y-2">
        <Link href={`/sites/${site.id}`} className="text-muted-foreground text-sm hover:underline">
          ← {site.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Modifier le site</h1>
      </div>
      <SiteForm
        siteId={site.id}
        client={client}
        defaultValues={{
          clientId: site.clientId,
          name: site.name,
          url: site.url,
          domain: site.domain,
          registrar: site.registrar,
          domainExpiresAt: site.domainExpiresAt ? dbDateToIso(site.domainExpiresAt) : "",
          domainExpiryAuto: site.domainExpiryAuto,
          hostingProvider: site.hostingProvider,
          hostingRenewsAt: site.hostingRenewsAt ? dbDateToIso(site.hostingRenewsAt) : "",
          notes: site.notes,
          monitor: site.monitor,
          showStatusToClient: site.showStatusToClient,
        }}
      />
    </>
  );
}
