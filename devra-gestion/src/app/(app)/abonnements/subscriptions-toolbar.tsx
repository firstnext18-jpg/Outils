"use client";

import { FilterSelect, useUrlFilters } from "@/components/list-filters";
import { SUBSCRIPTION_STATUS_LABELS } from "@/domain/subscriptions";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_STATUS_PARAMS } from "@/modules/subscriptions/schemas";

const ALL = "__tous__";

export function SubscriptionsToolbar() {
  const { searchParams, update, pending } = useUrlFilters();
  return (
    <div className={cn("flex gap-2", pending && "opacity-70")}>
      <FilterSelect
        label="Statut"
        value={searchParams.get("statut") ?? ALL}
        onChange={(value) => update({ statut: value === ALL ? null : value })}
        options={[
          { value: ALL, label: "Tous les statuts" },
          ...Object.entries(SUBSCRIPTION_STATUS_PARAMS).map(([value, status]) => ({
            value,
            label: SUBSCRIPTION_STATUS_LABELS[status],
          })),
        ]}
        className="sm:w-52"
      />
    </div>
  );
}
