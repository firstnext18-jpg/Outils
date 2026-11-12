"use client";

import { MessageComposer } from "@/components/discussions/message-composer";
import { MessageThread, type ThreadMessage } from "@/components/discussions/message-thread";
import type { PortalTexts } from "@/i18n/portal";
import { portalMarkReadAction, portalPostMessageAction } from "@/modules/portal/actions";

/** Fil et zone de saisie de la discussion, côté client. */
export function PortalThread({ messages, t }: { messages: ThreadMessage[]; t: PortalTexts }) {
  return (
    <>
      <MessageThread
        messages={messages}
        onSeen={() => portalMarkReadAction()}
        labels={{ list: t.messages, empty: t.noMessages }}
      />
      <MessageComposer
        onSend={async (body) => {
          const result = await portalPostMessageAction({ body });
          return result.ok ? null : result.error;
        }}
        labels={{ field: t.messageLabel, placeholder: t.messagePlaceholder, send: t.send }}
      />
    </>
  );
}
