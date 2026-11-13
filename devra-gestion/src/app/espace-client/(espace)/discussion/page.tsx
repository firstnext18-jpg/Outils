import type { Metadata } from "next";
import { PortalThread } from "@/app/espace-client/(espace)/discussion/portal-thread";
import { AutoRefresh } from "@/components/discussions/auto-refresh";
import type { ThreadMessage } from "@/components/discussions/message-thread";
import { fillLabel } from "@/i18n/documents";
import { portalTexts } from "@/i18n/portal";
import { formatDateTime } from "@/lib/format";
import { portalDiscussion } from "@/modules/portal/service";
import { displayCompanyName, getSettings } from "@/modules/settings/service";
import { requirePortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Discussion · Nachrichten" };

/** Messages d'une même personne à moins de 5 minutes d'intervalle : regroupés. */
const GROUP_MS = 5 * 60 * 1000;

type Message = Awaited<ReturnType<typeof portalDiscussion>>["messages"][number];

function continues(previous: Message | undefined, m: Message | undefined) {
  return Boolean(
    previous &&
    m &&
    previous.fromClient === m.fromClient &&
    previous.author?.name === m.author?.name &&
    m.createdAt.getTime() - previous.createdAt.getTime() < GROUP_MS,
  );
}

/**
 * Discussion du client avec l'équipe. Les discussions internes de l'équipe
 * (sur ce client ou non) ne sont jamais affichées ici.
 */
export default async function PortalDiscussionPage() {
  const { client } = await requirePortalSession();
  const t = portalTexts(client.language);
  const [discussion, settings] = await Promise.all([portalDiscussion(client.id), getSettings()]);
  const company = displayCompanyName(settings);

  const messages: ThreadMessage[] = discussion.messages.map((m, i) => {
    const next = discussion.messages[i + 1];
    const read = Boolean(discussion.teamReadAt && discussion.teamReadAt >= m.createdAt);
    return {
      id: m.id,
      author: m.fromClient ? t.you : (m.author?.name ?? company),
      badge: m.fromClient ? null : company,
      attachments: m.attachments.map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        href: `/api/espace-client/fichiers/${file.id}`,
        image: file.mimeType.startsWith("image/"),
      })),
      mine: m.fromClient,
      body: m.body,
      time: formatDateTime(m.createdAt),
      iso: m.createdAt.toISOString(),
      continued: continues(discussion.messages[i - 1], m),
      receipt:
        m.fromClient && !continues(m, next)
          ? { read, label: read ? t.readByTeam : t.notReadYet }
          : null,
    };
  });

  return (
    <>
      <AutoRefresh seconds={5} />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {fillLabel(t.discussionTitle, { company })}
        </h1>
        <p className="text-muted-foreground text-sm">{t.discussionHelp}</p>
      </div>
      <section className="bg-background space-y-3 rounded-lg border px-3 pt-3">
        <PortalThread messages={messages} t={t} />
      </section>
    </>
  );
}
