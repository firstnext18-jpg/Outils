"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runDailyTasks } from "@/modules/tasks/service";
import { authAction } from "@/server/action";

/** Lancement manuel des tâches quotidiennes (admin). */
export const runDailyTasksAction = authAction(
  { role: "ADMIN", schema: z.object({}) },
  async (_input, { user }) => {
    const result = await runDailyTasks("manual", user.id);
    revalidatePath("/", "layout");
    return result;
  },
);
