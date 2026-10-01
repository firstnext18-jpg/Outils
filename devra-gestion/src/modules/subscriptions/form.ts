import { dbDateToIso } from "@/domain/dates";
import { formatQuantity } from "@/domain/quantity";
import { formatAmount } from "@/lib/format";
import { discountToInput } from "@/modules/documents/lines";
import type { SubscriptionInput } from "@/modules/subscriptions/schemas";

type StoredSubscription = {
  clientId: string;
  label: string;
  periodicity: SubscriptionInput["periodicity"];
  startDate: Date;
  language: "FR" | "DE";
  notes: string;
  items: {
    catalogItemId: string | null;
    label: string;
    description: string;
    quantityMilli: number;
    unitPriceCents: number;
    discountType: "PERCENT" | "AMOUNT" | null;
    discountValue: number;
    vatRateBps: number | null;
  }[];
};

/** Abonnement enregistré → valeurs du formulaire de modification. */
export function subscriptionToInput(subscription: StoredSubscription): SubscriptionInput {
  return {
    clientId: subscription.clientId,
    label: subscription.label,
    periodicity: subscription.periodicity,
    startDate: dbDateToIso(subscription.startDate),
    language: subscription.language,
    notes: subscription.notes,
    items: subscription.items.map((item) => {
      const discount = discountToInput(item.discountType, item.discountValue);
      return {
        catalogItemId: item.catalogItemId,
        label: item.label,
        description: item.description,
        quantity: formatQuantity(item.quantityMilli),
        unitPrice: formatAmount(item.unitPriceCents),
        discountType: discount.type,
        discountValue: discount.value,
        vatRateBps: item.vatRateBps,
      };
    }),
  };
}
