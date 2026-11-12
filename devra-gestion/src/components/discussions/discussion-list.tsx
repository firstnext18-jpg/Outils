import { HashIcon, MessageSquareIcon, MessagesSquareIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DiscussionSummary } from "@/modules/discussions/service";

/** Liste des discussions : sujet, client, dernier message, pastille des non lus. */
export function DiscussionList({
  discussions,
  showClient = true,
}: {
  discussions: DiscussionSummary[];
  showClient?: boolean;
}) {
  return (
    <ul className="divide-y rounded-md border" aria-label="Discussions">
      {discussions.map((d) => {
        const Icon = d.general ? HashIcon : d.withClient ? MessagesSquareIcon : MessageSquareIcon;
        return (
          <li key={d.id}>
            <Link
              href={`/discussions/${d.id}`}
              className="hover:bg-muted/50 flex items-start gap-3 p-3 transition-colors"
            >
              <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={cn("truncate", d.unread > 0 ? "font-semibold" : "font-medium")}>
                    {d.title}
                  </span>
                  {showClient && d.client && (
                    <span className="text-muted-foreground truncate text-sm">
                      {d.client.displayName}
                    </span>
                  )}
                  {d.general && (
                    <span className="text-muted-foreground text-sm">Tous les utilisateurs</span>
                  )}
                  {d.withClient && (
                    <Badge variant="secondary" className="self-center">
                      Visible par le client
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground truncate text-sm">
                  {d.lastMessage
                    ? `${d.lastMessage.author} : ${d.lastMessage.excerpt}`
                    : "Aucun message pour l'instant."}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {d.lastMessage && (
                  <time
                    dateTime={d.lastMessageAt.toISOString()}
                    className="text-muted-foreground text-xs tabular-nums"
                  >
                    {formatDateTime(d.lastMessageAt)}
                  </time>
                )}
                {d.unread > 0 && (
                  <Badge className="tabular-nums" aria-label={`${d.unread} non lu(s)`}>
                    {d.unread}
                  </Badge>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
