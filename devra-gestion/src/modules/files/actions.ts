"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authAction } from "@/server/action";
import * as service from "@/modules/files/service";

/** Fichiers sur la fiche client : envoi (formulaire avec fichiers), partage, suppression. */
const uploadSchema = z.object({
  clientId: z.uuid("Client introuvable"),
  projectId: z.uuid().nullable(),
  visibleToClient: z.boolean(),
  files: z.array(z.instanceof(File)).min(1, "Choisissez au moins un fichier."),
});

const upload = authAction({ role: "MEMBER", schema: uploadSchema }, async (input, { user }) => {
  const count = await service.uploadClientFiles(user, input);
  revalidatePath(`/clients/${input.clientId}`);
  if (input.projectId) revalidatePath(`/projets/${input.projectId}`);
  return { count };
});

export async function uploadClientFilesAction(formData: FormData) {
  return upload({
    clientId: String(formData.get("clientId") ?? ""),
    projectId: formData.get("projectId") ? String(formData.get("projectId")) : null,
    visibleToClient: formData.get("visibleToClient") === "true",
    files: formData.getAll("files").filter((f): f is File => f instanceof File),
  });
}

export const setFileVisibilityAction = authAction(
  { role: "MEMBER", schema: z.object({ id: z.uuid(), visibleToClient: z.boolean() }) },
  async ({ id, visibleToClient }, { user }) => {
    const clientId = await service.setFileVisibility(user, id, visibleToClient);
    revalidatePath(`/clients/${clientId}`);
    return null;
  },
);

export const deleteFileAction = authAction(
  { role: "MEMBER", schema: z.object({ id: z.uuid() }) },
  async ({ id }, { user }) => {
    const { clientId, expenseId } = await service.deleteFile(user, id);
    if (clientId) revalidatePath(`/clients/${clientId}`);
    if (expenseId) revalidatePath(`/depenses/${expenseId}`);
    return null;
  },
);
