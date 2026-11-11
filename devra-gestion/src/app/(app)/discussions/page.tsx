import type { Metadata } from "next";
import { MessageSquarePlusIcon } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/discussions/auto-refresh";
import { DiscussionList } from "@/components/discussions/discussion-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { canEdit } from "@/domain/roles";
import { listDiscussions } from "@/modules/discussions/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Discussions" };

export default async function DiscussionsPage() {
  const user = await requireUser();
  const discussions = await listDiscussions(user.id);
  // Le canal général en tête, puis les discussions les plus actives.
  const sorted = [
    ...discussions.filter((d) => d.general),
    ...discussions.filter((d) => !d.general),
  ];

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHeader
        title="Discussions"
        description="Échangez avec les autres utilisateurs : canal général, et discussions sur chaque client."
        actions={
          canEdit(user.role) && (
            <Button asChild>
              <Link href="/discussions/nouvelle">
                <MessageSquarePlusIcon /> Nouvelle discussion
              </Link>
            </Button>
          )
        }
      />
      <DiscussionList discussions={sorted} />
      {sorted.length === 1 && (
        <p className="text-muted-foreground text-sm">
          Pour parler d&apos;un client en particulier, démarrez une discussion depuis sa fiche ou
          avec « Nouvelle discussion ».
        </p>
      )}
    </>
  );
}
