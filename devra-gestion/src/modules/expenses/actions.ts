"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  expenseIdSchema,
  expenseInputSchema,
  updateExpenseSchema,
} from "@/modules/expenses/schemas";
import * as service from "@/modules/expenses/service";
import { authAction } from "@/server/action";

function filesOf(formData: FormData) {
  return formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
}

const create = authAction(
  {
    role: "MEMBER",
    schema: z.object({ expense: expenseInputSchema, receipts: z.array(z.instanceof(File)).max(5) }),
  },
  async ({ expense, receipts }, { user }) => {
    const created = await service.createExpense(user, expense, receipts);
    revalidatePath("/depenses");
    revalidatePath("/");
    return { id: created.id };
  },
);

/** Nouvelle dépense : champs en JSON (« expense ») et justificatifs (« files »). */
export async function createExpenseAction(formData: FormData) {
  let expense: unknown = null;
  try {
    expense = JSON.parse(String(formData.get("expense") ?? "null"));
  } catch {
    // Laissé à la validation.
  }
  return create({
    expense: expense as z.input<typeof expenseInputSchema>,
    receipts: filesOf(formData),
  });
}

export const updateExpenseAction = authAction(
  { role: "MEMBER", schema: updateExpenseSchema },
  async ({ id, expense }, { user }) => {
    await service.updateExpense(user, id, expense);
    revalidatePath("/depenses");
    revalidatePath(`/depenses/${id}`);
    revalidatePath("/");
    return { id };
  },
);

const addReceipts = authAction(
  {
    role: "MEMBER",
    schema: z.object({ id: z.uuid(), receipts: z.array(z.instanceof(File)).min(1).max(5) }),
  },
  async ({ id, receipts }, { user }) => {
    await service.addReceipts(user, id, receipts);
    revalidatePath(`/depenses/${id}`);
    return null;
  },
);

export async function addReceiptsAction(formData: FormData) {
  return addReceipts({ id: String(formData.get("id") ?? ""), receipts: filesOf(formData) });
}

export const deleteExpenseAction = authAction(
  { role: "MEMBER", schema: expenseIdSchema },
  async ({ id }, { user }) => {
    await service.deleteExpense(user, id);
    revalidatePath("/depenses");
    revalidatePath("/");
    return null;
  },
);
