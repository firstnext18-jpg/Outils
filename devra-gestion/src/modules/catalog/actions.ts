"use server";

import { revalidatePath } from "next/cache";
import { authAction } from "@/server/action";
import {
  catalogItemIdSchema,
  createCatalogItemSchema,
  setCatalogItemActiveSchema,
  updateCatalogItemSchema,
} from "@/modules/catalog/schemas";
import * as service from "@/modules/catalog/service";

export const createCatalogItemAction = authAction(
  { role: "MEMBER", schema: createCatalogItemSchema },
  async ({ item }, { user }) => {
    const created = await service.createCatalogItem(user, item);
    revalidatePath("/catalogue");
    return { id: created.id };
  },
);

export const updateCatalogItemAction = authAction(
  { role: "MEMBER", schema: updateCatalogItemSchema },
  async ({ id, version, item }, { user }) => {
    await service.updateCatalogItem(user, id, version, item);
    revalidatePath("/catalogue");
    return null;
  },
);

export const setCatalogItemActiveAction = authAction(
  { role: "MEMBER", schema: setCatalogItemActiveSchema },
  async ({ id, active }, { user }) => {
    await service.setCatalogItemActive(user, id, active);
    revalidatePath("/catalogue");
    return null;
  },
);

export const deleteCatalogItemAction = authAction(
  { role: "MEMBER", schema: catalogItemIdSchema },
  async ({ id }, { user }) => {
    await service.deleteCatalogItem(user, id);
    revalidatePath("/catalogue");
    return null;
  },
);
