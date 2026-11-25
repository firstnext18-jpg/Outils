"use client";

import { useEffect } from "react";
import { markConversationReadAction } from "@/modules/mails/actions";

/** Conversation affichée dans un onglet visible : ses emails reçus sont marqués comme lus. */
export function MarkConversationRead({ clientId, unread }: { clientId: string; unread: number }) {
  useEffect(() => {
    if (unread === 0) return;
    const mark = () => {
      if (document.visibilityState === "visible") void markConversationReadAction({ clientId });
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [clientId, unread]);
  return null;
}
