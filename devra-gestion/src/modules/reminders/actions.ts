"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordReminderWithoutEmail } from "@/modules/reminders/service";
import { authAction } from "@/server/action";

/** Relance envoyée par courrier : elle est enregistrée et son PDF est prêt à imprimer. */
export const recordReminderAction = authAction(
  { role: "MEMBER", schema: z.object({ invoiceId: z.uuid() }) },
  async ({ invoiceId }, { user }) => {
    const reminder = await recordReminderWithoutEmail(user, invoiceId);
    revalidatePath(`/factures/${invoiceId}`);
    revalidatePath("/factures/relances");
    return reminder;
  },
);
