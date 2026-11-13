"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  partnerMovementIdSchema,
  partnerMovementInputSchema,
  updatePartnerMovementSchema,
} from "@/modules/partners/schemas";
import * as service from "@/modules/partners/service";
import { authAction } from "@/server/action";

/** Argent des associés : réservé aux admins. */

function filesOf(formData: FormData) {
  return formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
}

function refresh(id?: string) {
  revalidatePath("/apports");
  if (id) revalidatePath(`/apports/${id}`);
  revalidatePath("/");
}

const create = authAction(
  {
    role: "ADMIN",
    schema: z.object({
      movement: partnerMovementInputSchema,
      receipts: z.array(z.instanceof(File)).max(5),
    }),
  },
  async ({ movement, receipts }, { user }) => {
    const created = await service.createPartnerMovement(user, movement, receipts);
    refresh();
    return { id: created.id };
  },
);

/** Nouveau mouvement : champs en JSON (« movement ») et justificatifs (« files »). */
export async function createPartnerMovementAction(formData: FormData) {
  let movement: unknown = null;
  try {
    movement = JSON.parse(String(formData.get("movement") ?? "null"));
  } catch {
    // Laissé à la validation.
  }
  return create({
    movement: movement as z.input<typeof partnerMovementInputSchema>,
    receipts: filesOf(formData),
  });
}

export const updatePartnerMovementAction = authAction(
  { role: "ADMIN", schema: updatePartnerMovementSchema },
  async ({ id, movement }, { user }) => {
    await service.updatePartnerMovement(user, id, movement);
    refresh(id);
    return { id };
  },
);

const addReceipts = authAction(
  {
    role: "ADMIN",
    schema: z.object({ id: z.uuid(), receipts: z.array(z.instanceof(File)).min(1).max(5) }),
  },
  async ({ id, receipts }, { user }) => {
    await service.addPartnerReceipts(user, id, receipts);
    revalidatePath(`/apports/${id}`);
    return null;
  },
);

export async function addPartnerReceiptsAction(formData: FormData) {
  return addReceipts({ id: String(formData.get("id") ?? ""), receipts: filesOf(formData) });
}

export const deletePartnerMovementAction = authAction(
  { role: "ADMIN", schema: partnerMovementIdSchema },
  async ({ id }, { user }) => {
    await service.deletePartnerMovement(user, id);
    refresh();
    return null;
  },
);
