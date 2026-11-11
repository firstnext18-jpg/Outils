import type { Metadata } from "next";
import { HashIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Composer } from "@/app/(app)/discussions/[id]/composer";
import { Thread, type ThreadMessage } from "@/app/(app)/discussions/[id]/thread";
import { AutoRefresh } from "@/components/discussions/auto-refresh";
import { canEdit } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { getDiscussion, type DiscussionDetail } from "@/modules/discussions/service";
import { requireUser } from "@/server/session";

/** Messages d'une même personne à moins de 5 minutes d'intervalle : regroupés. */
const GROUP_MS = 5 * 60 * 1000;

function threadMessages(discussion: DiscussionDetail, userId: string): ThreadMessage[] {
  return discussion.messages.map((m, i) => {
    const previous = discussion.messages[i - 1];
    return {
      id: m.id,
      author: m.author?.name ?? "Ancien utilisateur",
      mine: m.authorId === userId,
      body: m.body,
      time: formatDateTime(m.createdAt),
      iso: m.createdAt.toISOString(),
      continued: Boolean(
        previous &&
        previous.authorId === m.authorId &&
        m.createdAt.getTime() - previous.createdAt.getTime() < GROUP_MS,
      ),
    };
  });
}

export async function generateMetadata({
  params,
}: PageProps<"/discussions/[id]">): Promise<Metadata> {
  const discussion = await getDiscussion((await params).id);
  return { title: discussion ? `Discussion · ${discussion.title}` : "Discussion" };
}

export default async function DiscussionPage({
  params,
  searchParams,
}: PageProps<"/discussions/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { tout } = await searchParams;
  const discussion = await getDiscussion(id, { all: tout === "1" });
  if (!discussion) notFound();

  return (
    <>
      <AutoRefresh seconds={5} />
      <div className="space-y-2">
        <Link href="/discussions" className="text-muted-foreground text-sm hover:underline">
          ← Discussions
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {discussion.general && <HashIcon className="text-muted-foreground size-5" />}
          {discussion.title}
        </h1>
        <p className="text-muted-foreground text-sm">
          {discussion.client ? (
            <>
              Client :{" "}
              <Link href={`/clients/${discussion.client.id}`} className="hover:underline">
                {discussion.client.displayName}
              </Link>
              {discussion.createdBy &&
                ` · démarrée par ${discussion.createdBy.name} le ${formatDateTime(discussion.createdAt)}`}
            </>
          ) : (
            "Canal général, ouvert à tous les utilisateurs."
          )}
        </p>
      </div>

      <section className="space-y-3">
        {discussion.hiddenCount > 0 && (
          <p className="text-center text-sm">
            <Link href={`/discussions/${discussion.id}?tout=1`} className="hover:underline">
              Afficher les {discussion.hiddenCount} message(s) plus ancien(s)
            </Link>
          </p>
        )}
        <Thread discussionId={discussion.id} messages={threadMessages(discussion, user.id)} />
        {canEdit(user.role) ? (
          <Composer discussionId={discussion.id} />
        ) : (
          <p className="text-muted-foreground border-t pt-3 text-sm">
            Accès en lecture seule : vous pouvez lire les discussions, sans y écrire.
          </p>
        )}
      </section>
    </>
  );
}
