"use client";

import { MessageComposer } from "@/components/discussions/message-composer";
import { MessageThread, type ThreadMessage } from "@/components/discussions/message-thread";
import {
  markReadAction,
  postMessageAction,
  postMessageWithFilesAction,
} from "@/modules/discussions/actions";

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
      onSend={async (body, files) => {
        let result;
        if (files.length) {
          const form = new FormData();
          form.set("discussionId", discussionId);
          form.set("body", body);
          for (const file of files) form.append("files", file);
          result = await postMessageWithFilesAction(form);
        } else {
          result = await postMessageAction({ discussionId, body });
        }
        return result.ok ? null : result.error;
      }}
      labels={{
        attach: "Joindre des fichiers",
        remove: "Retirer {name}",
        field: "Votre message",
        placeholder: withClient
          ? "Écrire au client… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
          : "Écrire un message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)",
        send: "Envoyer",
      }}
    />
  );
}
