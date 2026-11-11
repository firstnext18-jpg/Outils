import type { Metadata } from "next";
import { NewDiscussionForm } from "@/app/(app)/discussions/nouvelle/new-discussion-form";
import { PageHeader } from "@/components/page-header";
import { db } from "@/server/db";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouvelle discussion" };

export default async function NewDiscussionPage({
  searchParams,
}: PageProps<"/discussions/nouvelle">) {
  await requireRole("MEMBER");
  const { client: clientParam } = await searchParams;
  const client =
    typeof clientParam === "string" && /^[0-9a-f-]{36}$/i.test(clientParam)
      ? await db.client.findUnique({
          where: { id: clientParam },
          select: { id: true, displayName: true, city: true, language: true, siteTypeId: true },
        })
      : null;

  return (
    <>
      <PageHeader
        title="Nouvelle discussion"
        description="Les autres utilisateurs la verront dans « Discussions » et sur la fiche du client."
      />
      <NewDiscussionForm initialClient={client} />
    </>
  );
}
