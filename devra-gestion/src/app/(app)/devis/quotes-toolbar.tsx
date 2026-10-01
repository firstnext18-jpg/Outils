"use client";

import { FilterSelect, SearchField, useUrlFilters } from "@/components/list-filters";
import { QUOTE_STATUS_LABELS } from "@/domain/quote-status";
import { cn } from "@/lib/utils";
import { QUOTE_STATUS_PARAMS } from "@/modules/quotes/schemas";

const ALL = "__tous__";

export function QuotesToolbar() {
  const { searchParams, update, pending } = useUrlFilters();
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", pending && "opacity-70")}>
      <SearchField
        label="Rechercher un devis"
        placeholder="Numéro, client, objet…"
        initialValue={searchParams.get("q") ?? ""}
        onSearch={(q) => update({ q })}
      />
      <FilterSelect
        label="Statut"
        value={searchParams.get("statut") ?? ALL}
        onChange={(value) => update({ statut: value === ALL ? null : value })}
        options={[
          { value: ALL, label: "Tous les statuts" },
          ...Object.entries(QUOTE_STATUS_PARAMS).map(([value, status]) => ({
            value,
            label: QUOTE_STATUS_LABELS[status],
          })),
        ]}
        className="sm:w-48"
      />
    </div>
  );
}
