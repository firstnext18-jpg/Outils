"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authAction } from "@/server/action";
import { clientIdSchema, createClientSchema, updateClientSchema } from "@/modules/clients/schemas";
import * as service from "@/modules/clients/service";

export const createClientAction = authAction(
  { role: "MEMBER", schema: createClientSchema },
  async ({ client }, { user }) => {
    const created = await service.createClient(user, client);
    revalidatePath("/clients");
    return { id: created.id };
  },
);

export const updateClientAction = authAction(
  { role: "MEMBER", schema: updateClientSchema },
  async ({ id, version, client }, { user }) => {
    await service.updateClient(user, id, version, client);
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { id };
  },
);

export const setClientArchivedAction = authAction(
  { role: "MEMBER", schema: clientIdSchema.extend({ archived: z.boolean() }) },
  async ({ id, archived }, { user }) => {
    await service.setClientArchived(user, id, archived);
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return null;
  },
);

export const deleteClientAction = authAction(
  { role: "MEMBER", schema: clientIdSchema },
  async ({ id }, { user }) => {
    await service.deleteClient(user, id);
    revalidatePath("/clients");
    return null;
  },
);
