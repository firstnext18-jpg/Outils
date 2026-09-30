"use server";

import { revalidatePath } from "next/cache";
import { authAction, publicAction } from "@/server/action";
import {
  acceptInvitationSchema,
  changeRoleSchema,
  invitationIdSchema,
  inviteUserSchema,
  setActiveSchema,
} from "@/modules/users/schemas";
import * as service from "@/modules/users/service";

const USERS_PATH = "/parametres/utilisateurs";

export const inviteUserAction = authAction(
  { role: "ADMIN", schema: inviteUserSchema },
  async (input, { user }) => {
    await service.inviteUser(user, input);
    revalidatePath(USERS_PATH);
    return null;
  },
);

export const resendInvitationAction = authAction(
  { role: "ADMIN", schema: invitationIdSchema },
  async ({ invitationId }, { user }) => {
    await service.resendInvitation(user, invitationId);
    revalidatePath(USERS_PATH);
    return null;
  },
);

export const revokeInvitationAction = authAction(
  { role: "ADMIN", schema: invitationIdSchema },
  async ({ invitationId }, { user }) => {
    await service.revokeInvitation(user, invitationId);
    revalidatePath(USERS_PATH);
    return null;
  },
);

export const changeUserRoleAction = authAction(
  { role: "ADMIN", schema: changeRoleSchema },
  async ({ userId, role }, { user }) => {
    await service.changeUserRole(user, userId, role);
    revalidatePath(USERS_PATH);
    return null;
  },
);

export const setUserActiveAction = authAction(
  { role: "ADMIN", schema: setActiveSchema },
  async ({ userId, active }, { user }) => {
    await service.setUserActive(user, userId, active);
    revalidatePath(USERS_PATH);
    return null;
  },
);

/** Accessible sans être connecté : la personne invitée n'a pas encore de compte. */
export const acceptInvitationAction = publicAction(
  { schema: acceptInvitationSchema },
  async ({ token, name, password }) => service.acceptInvitation({ token, name, password }),
);
