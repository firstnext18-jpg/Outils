"use client";

import { SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGE_MAX } from "@/domain/discussions";
import { postMessageAction } from "@/modules/discussions/actions";

/** Zone de saisie : Entrée envoie, Maj+Entrée passe à la ligne. */
export function Composer({ discussionId }: { discussionId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim() || sending) return;
    setSending(true);
    const result = await postMessageAction({ discussionId, body });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
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
        aria-label="Votre message"
        placeholder="Écrire un message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
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
        <SendIcon /> Envoyer
      </Button>
    </form>
  );
}
