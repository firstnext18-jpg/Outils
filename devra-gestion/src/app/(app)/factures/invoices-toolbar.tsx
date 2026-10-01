"use client";

import { FilterSelect, SearchField, useUrlFilters } from "@/components/list-filters";
import { INVOICE_STATUS_LABELS } from "@/domain/invoice-status";
import { cn } from "@/lib/utils";
import { INVOICE_STATUS_PARAMS } from "@/modules/invoices/schemas";

const ALL = "__tous__";

export function InvoicesToolbar() {
  const { searchParams, update, pending } = useUrlFilters();
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", pending && "opacity-70")}>
      <SearchField
        label="Rechercher une facture"
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
          ...Object.entries(INVOICE_STATUS_PARAMS).map(([value, status]) => ({
            value,
            label: INVOICE_STATUS_LABELS[status],
          })),
        ]}
        className="sm:w-52"
      />
    </div>
  );
}
