"use client";

import { CheckCheckIcon, CheckIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { messageParts, nameInitials } from "@/domain/discussions";
import { cn } from "@/lib/utils";
import { markReadAction } from "@/modules/discussions/actions";

export type ThreadMessage = {
  id: string;
  author: string;
  mine: boolean;
  body: string;
  /** Date et heure déjà formatées (fuseau de Zurich). */
  time: string;
  iso: string;
  /** Suite d'un message de la même personne : sans répéter le nom. */
  continued: boolean;
  /** Accusé de lecture, montré à l'auteur seulement (dernier message de chaque groupe). */
  receipt: { read: boolean; label: string } | null;
};

function MessageBody({ body }: { body: string }) {
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {messageParts(body).map((part, i) =>
        part.url ? (
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

/**
 * Fil de la discussion. Marque la discussion comme lue quand de nouveaux
 * messages s'affichent dans un onglet visible, et descend au dernier message
 * (sauf si l'on est en train de relire plus haut).
 */
export function Thread({
  discussionId,
  messages,
}: {
  discussionId: string;
  messages: ThreadMessage[];
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;
  const firstRender = useRef(true);

  useLayoutEffect(() => {
    const nearBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300;
    if (firstRender.current || nearBottom) bottom.current?.scrollIntoView({ block: "end" });
    firstRender.current = false;
  }, [lastId]);

  useEffect(() => {
    const markRead = () => {
      if (document.visibilityState === "visible") void markReadAction({ discussionId });
    };
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [discussionId, lastId]);

  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
        Aucun message pour l&apos;instant. Écrivez le premier !
      </p>
    );
  }

  return (
    <>
      <ol className="space-y-1" aria-label="Messages">
        {messages.map((m) => (
          <li
            key={m.id}
            className={cn("flex gap-3 rounded-md px-2 py-1", !m.continued && "mt-3 first:mt-0")}
          >
            <div className="w-8 shrink-0">
              {!m.continued && (
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className={cn("rounded-lg text-xs", m.mine && "bg-primary/15")}>
                    {nameInitials(m.author)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {!m.continued && (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{m.author}</span>
                  <time dateTime={m.iso} className="text-muted-foreground text-xs tabular-nums">
                    {m.time}
                  </time>
                </div>
              )}
              <MessageBody body={m.body} />
              {m.receipt && (
                <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                  {m.receipt.read ? (
                    <CheckCheckIcon className="text-primary size-3.5" aria-hidden />
                  ) : (
                    <CheckIcon className="size-3.5" aria-hidden />
                  )}
                  {m.receipt.label}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div ref={bottom} />
    </>
  );
}
