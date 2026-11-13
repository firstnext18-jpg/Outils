"use server";

import { revalidatePath } from "next/cache";
import { authAction } from "@/server/action";
import { createSiteSchema, siteIdSchema, updateSiteSchema } from "@/modules/sites/schemas";
import * as service from "@/modules/sites/service";

function refresh(siteId: string, clientId: string) {
  revalidatePath("/sites");
  revalidatePath(`/sites/${siteId}`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/calendrier");
}

export const createSiteAction = authAction(
  { role: "MEMBER", schema: createSiteSchema },
  async ({ site }, { user }) => {
    const created = await service.createSite(user, site);
    refresh(created.id, created.clientId);
    return { id: created.id };
  },
);

export const updateSiteAction = authAction(
  { role: "MEMBER", schema: updateSiteSchema },
  async ({ id, site }, { user }) => {
    const updated = await service.updateSite(user, id, site);
    refresh(id, updated.clientId);
    return { id };
  },
);

export const deleteSiteAction = authAction(
  { role: "MEMBER", schema: siteIdSchema },
  async ({ id }, { user }) => {
    const site = await service.deleteSite(user, id);
    revalidatePath("/sites");
    revalidatePath(`/clients/${site.clientId}`);
    revalidatePath("/calendrier");
    return null;
  },
);

export const checkSiteNowAction = authAction(
  { role: "MEMBER", schema: siteIdSchema },
  async ({ id }) => {
    await service.checkSiteNow(id);
    revalidatePath("/sites");
    revalidatePath(`/sites/${id}`);
    return null;
  },
);
