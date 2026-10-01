"use server";

import { revalidatePath } from "next/cache";
import { authAction } from "@/server/action";
import {
  changeQuoteStatusSchema,
  createQuoteSchema,
  quoteIdSchema,
  updateQuoteSchema,
} from "@/modules/quotes/schemas";
import * as service from "@/modules/quotes/service";

function refresh(id?: string) {
  revalidatePath("/devis");
  if (id) revalidatePath(`/devis/${id}`);
  revalidatePath("/clients/[id]", "page");
}

export const createQuoteAction = authAction(
  { role: "MEMBER", schema: createQuoteSchema },
  async ({ quote }, { user }) => {
    const created = await service.createQuote(user, quote);
    refresh(created.id);
    return { id: created.id, number: created.number };
  },
);

export const updateQuoteAction = authAction(
  { role: "MEMBER", schema: updateQuoteSchema },
  async ({ id, version, quote }, { user }) => {
    await service.updateQuote(user, id, version, quote);
    refresh(id);
    return { id };
  },
);

export const changeQuoteStatusAction = authAction(
  { role: "MEMBER", schema: changeQuoteStatusSchema },
  async ({ id, status }, { user }) => {
    await service.changeQuoteStatus(user, id, status);
    refresh(id);
    return null;
  },
);

export const duplicateQuoteAction = authAction(
  { role: "MEMBER", schema: quoteIdSchema },
  async ({ id }, { user }) => {
    const copy = await service.duplicateQuote(user, id);
    refresh(copy.id);
    return { id: copy.id, number: copy.number };
  },
);

export const deleteQuoteAction = authAction(
  { role: "MEMBER", schema: quoteIdSchema },
  async ({ id }, { user }) => {
    await service.deleteQuote(user, id);
    refresh();
    return null;
  },
);
