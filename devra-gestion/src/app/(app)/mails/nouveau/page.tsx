import type { Metadata } from "next";
import Link from "next/link";
import { MailComposer } from "@/components/mails/mail-composer";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouvel email" };

export default async function NewMailPage({ searchParams }: PageProps<"/mails/nouveau">) {
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
        <Link href="/mails" className="text-muted-foreground text-sm hover:underline">
          ← Mail
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvel email</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <MailComposer client={client} />
        </CardContent>
      </Card>
    </>
  );
}
