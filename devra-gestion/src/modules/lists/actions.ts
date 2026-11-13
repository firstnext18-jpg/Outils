"use server";

import { revalidatePath } from "next/cache";
import { authAction } from "@/server/action";
import {
  createListItemSchema,
  listItemIdSchema,
  moveListItemSchema,
  renameListItemSchema,
  setListItemActiveSchema,
} from "@/modules/lists/schemas";
import * as service from "@/modules/lists/service";

const PATH = "/parametres/listes";

export const createListItemAction = authAction(
  { role: "ADMIN", schema: createListItemSchema },
  async ({ kind, name }, { user }) => {
    await service.createListItem(user, kind, name);
    revalidatePath(PATH);
    return null;
  },
);

export const renameListItemAction = authAction(
  { role: "ADMIN", schema: renameListItemSchema },
  async ({ id, name }, { user }) => {
    await service.renameListItem(user, id, name);
    revalidatePath(PATH);
    return null;
  },
);

export const setListItemActiveAction = authAction(
  { role: "ADMIN", schema: setListItemActiveSchema },
  async ({ id, active }, { user }) => {
    await service.setListItemActive(user, id, active);
    revalidatePath(PATH);
    return null;
  },
);

export const moveListItemAction = authAction(
  { role: "ADMIN", schema: moveListItemSchema },
  async ({ id, direction }, { user }) => {
    await service.moveListItem(user, id, direction);
    revalidatePath(PATH);
    return null;
  },
);

export const deleteListItemAction = authAction(
  { role: "ADMIN", schema: listItemIdSchema },
  async ({ id }, { user }) => {
    await service.deleteListItem(user, id);
    revalidatePath(PATH);
    return null;
  },
);
