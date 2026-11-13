"use server";

import { revalidatePath } from "next/cache";
import { authAction } from "@/server/action";
import {
  billTimeSchema,
  createTimeEntrySchema,
  startTimerSchema,
  timeEntryIdSchema,
  updateTimeEntrySchema,
} from "@/modules/time/schemas";
import * as service from "@/modules/time/service";
import { z } from "zod";

function refresh(projectId?: string | null) {
  revalidatePath("/temps");
  if (projectId) revalidatePath(`/projets/${projectId}`);
}

export const createTimeEntryAction = authAction(
  { role: "MEMBER", schema: createTimeEntrySchema },
  async ({ entry }, { user }) => {
    const created = await service.createTimeEntry(user, entry);
    refresh(created.projectId);
    return null;
  },
);

export const updateTimeEntryAction = authAction(
  { role: "MEMBER", schema: updateTimeEntrySchema },
  async ({ id, entry }, { user }) => {
    const updated = await service.updateTimeEntry(user, id, entry);
    refresh(updated.projectId);
    return null;
  },
);

export const deleteTimeEntryAction = authAction(
  { role: "MEMBER", schema: timeEntryIdSchema },
  async ({ id }, { user }) => {
    const deleted = await service.deleteTimeEntry(user, id);
    refresh(deleted.projectId);
    return null;
  },
);

export const startTimerAction = authAction(
  { role: "MEMBER", schema: startTimerSchema },
  async (input, { user }) => {
    await service.startTimer(user, input);
    refresh(input.projectId);
    return null;
  },
);

export const stopTimerAction = authAction(
  { role: "MEMBER", schema: z.object({}) },
  async (_input, { user }) => {
    const stopped = await service.stopTimer(user);
    refresh(stopped?.projectId);
    return stopped ? { minutes: stopped.minutes } : null;
  },
);

export const billTimeAction = authAction(
  { role: "MEMBER", schema: billTimeSchema },
  async ({ clientId }, { user }) => {
    const invoice = await service.billClientTime(user, clientId);
    revalidatePath("/temps");
    revalidatePath("/factures");
    revalidatePath(`/clients/${clientId}`);
    return { invoiceId: invoice.id };
  },
);
