"use client";

import { MessageComposer } from "@/components/discussions/message-composer";
import { MessageThread, type ThreadMessage } from "@/components/discussions/message-thread";
import { markReadAction, postMessageAction } from "@/modules/discussions/actions";

/** Fil et zone de saisie d'une discussion, côté équipe. */
export function TeamThread({
  discussionId,
  messages,
}: {
  discussionId: string;
  messages: ThreadMessage[];
}) {
  return (
    <MessageThread
      messages={messages}
      onSeen={() => markReadAction({ discussionId })}
      labels={{ list: "Messages", empty: "Aucun message pour l'instant. Écrivez le premier !" }}
    />
  );
}

export function TeamComposer({
  discussionId,
  withClient,
}: {
  discussionId: string;
  withClient: boolean;
}) {
  return (
    <MessageComposer
      onSend={async (body) => {
        const result = await postMessageAction({ discussionId, body });
        return result.ok ? null : result.error;
      }}
      labels={{
        field: "Votre message",
        placeholder: withClient
          ? "Écrire au client… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
          : "Écrire un message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)",
        send: "Envoyer",
      }}
    />
  );
}
