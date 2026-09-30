"use server";

import { revalidatePath } from "next/cache";
import { authAction } from "@/server/action";
import {
  createSiteTypeSchema,
  moveSiteTypeSchema,
  renameSiteTypeSchema,
  setSiteTypeActiveSchema,
  siteTypeIdSchema,
} from "@/modules/site-types/schemas";
import * as service from "@/modules/site-types/service";

const PATH = "/parametres/types-de-sites";

export const createSiteTypeAction = authAction(
  { role: "ADMIN", schema: createSiteTypeSchema },
  async ({ name }, { user }) => {
    await service.createSiteType(user, name);
    revalidatePath(PATH);
    return null;
  },
);

export const renameSiteTypeAction = authAction(
  { role: "ADMIN", schema: renameSiteTypeSchema },
  async ({ id, name }, { user }) => {
    await service.renameSiteType(user, id, name);
    revalidatePath(PATH);
    return null;
  },
);

export const setSiteTypeActiveAction = authAction(
  { role: "ADMIN", schema: setSiteTypeActiveSchema },
  async ({ id, active }, { user }) => {
    await service.setSiteTypeActive(user, id, active);
    revalidatePath(PATH);
    return null;
  },
);

export const moveSiteTypeAction = authAction(
  { role: "ADMIN", schema: moveSiteTypeSchema },
  async ({ id, direction }, { user }) => {
    await service.moveSiteType(user, id, direction);
    revalidatePath(PATH);
    return null;
  },
);

export const deleteSiteTypeAction = authAction(
  { role: "ADMIN", schema: siteTypeIdSchema },
  async ({ id }, { user }) => {
    await service.deleteSiteType(user, id);
    revalidatePath(PATH);
    return null;
  },
);
