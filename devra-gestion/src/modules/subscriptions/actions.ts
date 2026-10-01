"use server";

import { revalidatePath } from "next/cache";
import {
  createSubscriptionSchema,
  subscriptionFromQuoteSchema,
  subscriptionIdSchema,
  updateSubscriptionSchema,
} from "@/modules/subscriptions/schemas";
import * as service from "@/modules/subscriptions/service";
import { authAction } from "@/server/action";

function refresh(id?: string) {
  revalidatePath("/abonnements");
  if (id) revalidatePath(`/abonnements/${id}`);
  revalidatePath("/clients/[id]", "page");
  revalidatePath("/devis/[id]", "page");
}

export const createSubscriptionAction = authAction(
  { role: "MEMBER", schema: createSubscriptionSchema },
  async ({ subscription }, { user }) => {
    const created = await service.createSubscription(user, subscription);
    refresh(created.id);
    return { id: created.id };
  },
);

export const updateSubscriptionAction = authAction(
  { role: "MEMBER", schema: updateSubscriptionSchema },
  async ({ id, version, subscription }, { user }) => {
    await service.updateSubscription(user, id, version, subscription);
    refresh(id);
    return { id };
  },
);

export const pauseSubscriptionAction = authAction(
  { role: "MEMBER", schema: subscriptionIdSchema },
  async ({ id }, { user }) => {
    await service.pauseSubscription(user, id);
    refresh(id);
    return null;
  },
);

export const resumeSubscriptionAction = authAction(
  { role: "MEMBER", schema: subscriptionIdSchema },
  async ({ id }, { user }) => {
    await service.resumeSubscription(user, id);
    refresh(id);
    return null;
  },
);

export const cancelSubscriptionAction = authAction(
  { role: "MEMBER", schema: subscriptionIdSchema },
  async ({ id }, { user }) => {
    await service.cancelSubscription(user, id);
    refresh(id);
    return null;
  },
);

export const deleteSubscriptionAction = authAction(
  { role: "MEMBER", schema: subscriptionIdSchema },
  async ({ id }, { user }) => {
    await service.deleteSubscription(user, id);
    refresh();
    return null;
  },
);

export const createSubscriptionsFromQuoteAction = authAction(
  { role: "MEMBER", schema: subscriptionFromQuoteSchema },
  async ({ quoteId, startDate }, { user }) => {
    const created = await service.createSubscriptionsFromQuote(user, quoteId, startDate);
    refresh();
    return { ids: created.map((s) => s.id) };
  },
);
