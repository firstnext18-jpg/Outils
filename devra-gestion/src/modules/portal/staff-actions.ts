"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PASSWORD_MAX_LENGTH } from "@/modules/users/schemas";
import * as access from "@/modules/portal/access";
import { authAction } from "@/server/action";

/** Gestion de l'accès des clients à leur espace, depuis la fiche client (membres et admins). */
const clientIdSchema = z.object({ clientId: z.uuid("Client introuvable") });

export const createPortalAccessAction = authAction(
  { role: "MEMBER", schema: clientIdSchema },
  async ({ clientId }, { user }) => {
    const credentials = await access.createPortalAccess(user, clientId);
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/discussions");
    return credentials;
  },
);

export const regeneratePortalPasswordAction = authAction(
  { role: "MEMBER", schema: clientIdSchema },
  async ({ clientId }, { user }) => {
    const credentials = await access.regeneratePortalPassword(user, clientId);
    revalidatePath(`/clients/${clientId}`);
    return credentials;
  },
);

export const setPortalAccessActiveAction = authAction(
  { role: "MEMBER", schema: clientIdSchema.extend({ active: z.boolean() }) },
  async ({ clientId, active }, { user }) => {
    await access.setPortalAccessActive(user, clientId, active);
    revalidatePath(`/clients/${clientId}`);
    return null;
  },
);

export const emailPortalCredentialsAction = authAction(
  {
    role: "MEMBER",
    schema: clientIdSchema.extend({ password: z.string().min(1).max(PASSWORD_MAX_LENGTH) }),
  },
  async ({ clientId, password }, { user }) =>
    access.emailPortalCredentials(user, clientId, password),
);
