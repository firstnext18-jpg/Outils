"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { authAction } from "@/server/action";
import type { CurrentUser } from "@/server/session";
import {
  createDiscussionSchema,
  markReadSchema,
  postMessageSchema,
  postMessageWithFilesSchema,
  pushEndpointSchema,
  pushSubscriptionSchema,
} from "@/modules/discussions/schemas";
import * as service from "@/modules/discussions/service";

/** Les notifications partent après la réponse : l'envoi d'un message reste immédiat. */
function notifyLater(...args: Parameters<typeof service.notifyOthers>) {
  after(() =>
    service.notifyOthers(...args).catch((error: unknown) => {
      console.error("Notifications de la discussion impossibles", error);
    }),
  );
}

export const createDiscussionAction = authAction(
  { role: "MEMBER", schema: createDiscussionSchema },
  async (input, { user }) => {
    const { id, notification } = await service.createDiscussion(user, input);
    notifyLater(user, id, notification);
    revalidatePath("/discussions");
    revalidatePath(`/clients/${input.clientId}`);
    return { id };
  },
);

async function post(
  user: CurrentUser,
  input: { discussionId: string; body: string },
  files: File[],
) {
  const { id, withClient, notification, summary } = await service.postMessage(user, input, files);
  notifyLater(user, id, notification);
  // Discussion avec le client : il est prévenu par email.
  if (withClient) {
    after(() =>
      service.notifyClient(user, id, summary).catch((error: unknown) => {
        console.error("Email au client impossible", error);
      }),
    );
  }
  return null;
}

export const postMessageAction = authAction(
  { role: "MEMBER", schema: postMessageSchema },
  async (input, { user }) => post(user, input, []),
);

const postWithFiles = authAction(
  { role: "MEMBER", schema: postMessageWithFilesSchema },
  async ({ files, ...input }, { user }) => post(user, input, files),
);

/** Message avec pièces jointes (formulaire avec fichiers). */
export async function postMessageWithFilesAction(formData: FormData) {
  return postWithFiles({
    discussionId: String(formData.get("discussionId") ?? ""),
    body: String(formData.get("body") ?? ""),
    files: formData.getAll("files").filter((f): f is File => f instanceof File),
  });
}

/** Consultation : accessible à tous les rôles, lecture seule comprise. */
export const markReadAction = authAction(
  { role: "READONLY", schema: markReadSchema },
  async ({ discussionId }, { user }) => {
    await service.markRead(user, discussionId);
    return null;
  },
);

export const savePushSubscriptionAction = authAction(
  { role: "READONLY", schema: pushSubscriptionSchema },
  async (input, { user }) => {
    await service.savePushSubscription(user, input);
    return null;
  },
);

export const deletePushSubscriptionAction = authAction(
  { role: "READONLY", schema: pushEndpointSchema },
  async ({ endpoint }, { user }) => {
    await service.deletePushSubscription(user, endpoint);
    return null;
  },
);
