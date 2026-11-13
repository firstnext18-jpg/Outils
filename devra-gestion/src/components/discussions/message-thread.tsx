"use client";

import { CheckCheckIcon, CheckIcon, PaperclipIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { messageParts, nameInitials } from "@/domain/discussions";
import { formatFileSize } from "@/domain/files";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  author: string;
  /** Petite étiquette à côté du nom (ex. « Client »). */
  badge?: string | null;
  mine: boolean;
  body: string;
  /** Date et heure déjà formatées (fuseau de Zurich). */
  time: string;
  iso: string;
  /** Suite d'un message de la même personne : sans répéter le nom. */
  continued: boolean;
  /** Accusé de lecture, montré à l'auteur seulement (dernier message de chaque groupe). */
  receipt: { read: boolean; label: string } | null;
  /** Pièces jointes : lien de téléchargement, aperçu pour les images. */
  attachments?: { id: string; name: string; size: number; href: string; image: boolean }[];
};

function Attachments({ files }: { files: NonNullable<ThreadMessage["attachments"]> }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-2">
      {files.map((file) => (
        <li key={file.id}>
          <a
            href={file.href}
            download={file.name}
            className="hover:bg-muted flex max-w-xs items-center gap-2 rounded-md border p-1.5 text-xs"
          >
            {file.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- fichier servi par l'API
              <img
                src={`${file.href}?apercu=1`}
                alt=""
                className="size-10 rounded object-cover"
                loading="lazy"
              />
            ) : (
              <PaperclipIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="block truncate font-medium">{file.name}</span>
              <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

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
 * Fil d'une discussion (équipe ou espace client). Signale la lecture
 * (`onSeen`) quand de nouveaux messages s'affichent dans un onglet visible, et
 * descend au dernier message (sauf si l'on est en train de relire plus haut).
 */
export function MessageThread({
  messages,
  onSeen,
  labels,
}: {
  messages: ThreadMessage[];
  onSeen: () => Promise<unknown>;
  labels: { list: string; empty: string };
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id;
  const firstRender = useRef(true);
  // La fonction change à chaque rafraîchissement : seul un nouveau message déclenche l'appel.
  const seen = useRef(onSeen);
  useEffect(() => {
    seen.current = onSeen;
  });

  useLayoutEffect(() => {
    const nearBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300;
    if (firstRender.current || nearBottom) bottom.current?.scrollIntoView({ block: "end" });
    firstRender.current = false;
  }, [lastId]);

  useEffect(() => {
    const markRead = () => {
      if (document.visibilityState === "visible") void seen.current();
    };
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [lastId]);

  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
        {labels.empty}
      </p>
    );
  }

  return (
    <>
      <ol className="space-y-1" aria-label={labels.list}>
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
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{m.author}</span>
                  {m.badge && (
                    <Badge variant="secondary" className="self-center px-1.5 py-0 text-[11px]">
                      {m.badge}
                    </Badge>
                  )}
                  <time dateTime={m.iso} className="text-muted-foreground text-xs tabular-nums">
                    {m.time}
                  </time>
                </div>
              )}
              {m.body && <MessageBody body={m.body} />}
              {m.attachments && m.attachments.length > 0 && <Attachments files={m.attachments} />}
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
