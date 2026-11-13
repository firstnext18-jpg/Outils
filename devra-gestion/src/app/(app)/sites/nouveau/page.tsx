import type { Metadata } from "next";
import Link from "next/link";
import { SiteForm } from "@/app/(app)/sites/site-form";
import { db } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouveau site" };

export default async function NewSitePage({ searchParams }: PageProps<"/sites/nouveau">) {
  await requireRole("MEMBER");
  const { client: clientId } = await searchParams;
  const client =
    typeof clientId === "string" && /^[0-9a-f-]{36}$/i.test(clientId)
      ? await db.client.findUnique({
          where: { id: clientId },
          select: { id: true, displayName: true, city: true, language: true, siteTypeId: true },
        })
      : null;
  return (
    <>
      <div className="space-y-2">
        <Link href="/sites" className="text-muted-foreground text-sm hover:underline">
          ← Sites
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau site</h1>
      </div>
      <SiteForm
        client={client}
        defaultValues={{
          clientId: client?.id ?? "",
          name: "",
          url: "",
          domain: "",
          registrar: "",
          domainExpiresAt: "",
          domainExpiryAuto: true,
          hostingProvider: "",
          hostingRenewsAt: "",
          notes: "",
          monitor: true,
          showStatusToClient: true,
        }}
      />
    </>
  );
}
