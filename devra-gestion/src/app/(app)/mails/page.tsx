import type { Metadata } from "next";
import { MailIcon, PenSquareIcon } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/discussions/auto-refresh";
import { UnreadCount } from "@/components/discussions/unread-count";
import { EmptyState } from "@/components/empty-state";
import { MailSyncButton } from "@/components/mails/mail-sync-button";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { canEdit } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listConversations, mailboxStatus } from "@/modules/mails/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Mail" };

/** Emails échangés avec les clients : une conversation par client, la plus récente d'abord. */
export default async function MailsPage() {
  const user = await requireUser();
  const [conversations, status] = await Promise.all([listConversations(), mailboxStatus()]);

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title="Mail"
        description="Emails envoyés aux clients et leurs réponses, rangés par client."
        actions={
          <>
            {status.configured && <MailSyncButton />}
            {canEdit(user.role) && (
              <Button asChild>
                <Link href="/mails/nouveau">
                  <PenSquareIcon /> Nouvel email
                </Link>
              </Button>
            )}
          </>
        }
      />

      <p
        className={cn("text-sm", status.lastError ? "text-destructive" : "text-muted-foreground")}
        role={status.lastError ? "alert" : undefined}
      >
        {!status.configured
          ? "Réponses des clients non relevées : la boîte mail n'est pas encore configurée (voir docs/SECTION_MAIL.md)."
          : status.lastError
            ? `Relève de ${status.address} impossible : ${status.lastError}`
            : `Réponses relevées dans ${status.address}${
                status.lastSyncAt
                  ? ` · dernière relève le ${formatDateTime(status.lastSyncAt)}`
                  : ""
              }.`}
      </p>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MailIcon}
          title="Aucun email pour l'instant"
          description="Écrivez à un client : sa réponse apparaîtra ici, avec les autres emails qu'il vous envoie."
        />
      ) : (
        <ul className="divide-y rounded-md border" aria-label="Conversations">
          {conversations.map((c) => (
            <li key={c.client.id}>
              <Link
                href={`/mails/${c.client.id}`}
                className="hover:bg-muted/50 flex items-start gap-3 p-3 transition-colors"
              >
                <MailIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span
                      className={cn("truncate", c.unread > 0 ? "font-semibold" : "font-medium")}
                    >
                      {c.client.displayName}
                    </span>
                    <span className="text-muted-foreground truncate text-sm">{c.lastSubject}</span>
                  </div>
                  <p className="text-muted-foreground truncate text-sm">
                    {c.lastIncoming ? "" : "Vous : "}
                    {c.lastExcerpt}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <time
                    dateTime={c.lastDate.toISOString()}
                    className="text-muted-foreground text-xs tabular-nums"
                  >
                    {formatDateTime(c.lastDate)}
                  </time>
                  <UnreadCount count={c.unread} noun="email" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
