"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mailInputSchema } from "@/modules/mails/schemas";
import * as service from "@/modules/mails/service";
import { authAction } from "@/server/action";

function filesOf(formData: FormData) {
  return formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
}

const send = authAction(
  {
    role: "MEMBER",
    schema: z.object({ mail: mailInputSchema, files: z.array(z.instanceof(File)).max(5) }),
  },
  async ({ mail, files }, { user }) => {
    const { message, raw } = await service.sendClientEmail(user, mail, files);
    // Copie dans « Envoyés » après la réponse : l'envoi reste immédiat.
    after(() => service.copyToSentFolder(raw));
    revalidatePath("/mails");
    revalidatePath(`/mails/${mail.clientId}`);
    revalidatePath(`/clients/${mail.clientId}`);
    return { id: message.id, clientId: mail.clientId };
  },
);

/** Envoi : champs en JSON (« mail ») et pièces jointes (« files »). */
export async function sendClientEmailAction(formData: FormData) {
  let mail: unknown = null;
  try {
    mail = JSON.parse(String(formData.get("mail") ?? "null"));
  } catch {
    // Laissé à la validation.
  }
  return send({ mail: mail as z.input<typeof mailInputSchema>, files: filesOf(formData) });
}

/** « Relever les mails » : relève immédiate de la boîte. */
export const syncMailboxAction = authAction(
  { role: "READONLY", schema: z.object({}) },
  async () => {
    const result = await service.syncMailbox();
    revalidatePath("/mails");
    if (!result.ok) return { imported: 0, error: result.error };
    return { imported: result.imported, error: result.skipped ?? null };
  },
);

/** Conversation affichée : ses emails reçus sont marqués comme lus. */
export const markConversationReadAction = authAction(
  { role: "READONLY", schema: z.object({ clientId: z.uuid() }) },
  async ({ clientId }) => {
    await service.markConversationRead(clientId);
    revalidatePath("/mails");
    return null;
  },
);
