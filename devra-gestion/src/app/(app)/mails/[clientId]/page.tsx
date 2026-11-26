import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/discussions/auto-refresh";
import { MailComposer } from "@/components/mails/mail-composer";
import { MailThread } from "@/components/mails/mail-thread";
import { MarkConversationRead } from "@/components/mails/mark-read";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { replySubject } from "@/domain/mails";
import { canEdit } from "@/domain/roles";
import { getConversation } from "@/modules/mails/service";
import { requireUser } from "@/server/session";

export async function generateMetadata({
  params,
}: PageProps<"/mails/[clientId]">): Promise<Metadata> {
  const { clientId } = await params;
  const conversation = /^[0-9a-f-]{36}$/i.test(clientId) ? await getConversation(clientId) : null;
  return { title: conversation ? `Mail · ${conversation.client.displayName}` : "Mail" };
}

/** Emails échangés avec un client, et réponse. */
export default async function MailConversationPage({ params }: PageProps<"/mails/[clientId]">) {
  const user = await requireUser();
  const { clientId } = await params;
  const conversation = /^[0-9a-f-]{36}$/i.test(clientId) ? await getConversation(clientId) : null;
  if (!conversation) notFound();
  const { client, messages } = conversation;
  const unread = messages.filter((m) => m.direction === "INCOMING" && !m.readAt).length;
  const last = messages.at(-1);
  const lastIncoming = [...messages].reverse().find((m) => m.direction === "INCOMING");

  return (
    <>
      <AutoRefresh seconds={30} />
      <MarkConversationRead clientId={client.id} unread={unread} />
      <div className="space-y-2">
        <Link href="/mails" className="text-muted-foreground text-sm hover:underline">
          ← Mail
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{client.displayName}</h1>
        <p className="text-muted-foreground text-sm">
          {client.email || "Pas d'adresse email sur la fiche"} ·{" "}
          <Link href={`/clients/${client.id}`} className="hover:underline">
            Fiche du client
          </Link>
        </p>
      </div>

      {messages.length > 0 ? (
        <MailThread mails={messages} clientName={client.displayName} />
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          Aucun email échangé avec ce client pour l&apos;instant.
        </p>
      )}

      {canEdit(user.role) && client.email && (
        <Card>
          <CardHeader>
            <CardTitle>{last ? "Répondre" : "Écrire"}</CardTitle>
          </CardHeader>
          <CardContent>
            <MailComposer
              client={{ id: client.id }}
              recipient={client.email}
              defaultSubject={last ? replySubject(last.subject) : ""}
              replyToId={(lastIncoming ?? last)?.id ?? null}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
