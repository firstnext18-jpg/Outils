"use client";

import { SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGE_MAX } from "@/domain/discussions";

/**
 * Zone de saisie d'un message (équipe ou espace client) : Entrée envoie,
 * Maj+Entrée passe à la ligne. `onSend` renvoie un message d'erreur, ou `null`.
 */
export function MessageComposer({
  onSend,
  labels,
}: {
  onSend: (body: string) => Promise<string | null>;
  labels: { field: string; placeholder: string; send: string };
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim() || sending) return;
    setSending(true);
    const error = await onSend(body);
    setSending(false);
    if (error) {
      toast.error(error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form
      className="bg-background sticky bottom-0 flex items-end gap-2 border-t py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <Textarea
        aria-label={labels.field}
        placeholder={labels.placeholder}
        value={body}
        maxLength={MESSAGE_MAX}
        rows={2}
        className="max-h-48 min-h-11 resize-none"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void send();
          }
        }}
      />
      <Button type="submit" disabled={sending || !body.trim()}>
        <SendIcon /> {labels.send}
      </Button>
    </form>
  );
}
