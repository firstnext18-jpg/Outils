"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authAction } from "@/server/action";
import { createCalendarFeed, deleteCalendarFeed } from "@/modules/calendar/service";

/** Nouvelle adresse d'abonnement personnelle (remplace l'ancienne). */
export const createCalendarFeedAction = authAction(
  { role: "READONLY", schema: z.object({}) },
  async (_input, { user }) => {
    const url = await createCalendarFeed(user.id);
    revalidatePath("/calendrier");
    return { url };
  },
);

export const deleteCalendarFeedAction = authAction(
  { role: "READONLY", schema: z.object({}) },
  async (_input, { user }) => {
    await deleteCalendarFeed(user.id);
    revalidatePath("/calendrier");
    return null;
  },
);
