"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";
import { FilterSelect, SearchField, useUrlFilters } from "@/components/list-filters";
import { Button } from "@/components/ui/button";
import { LINE_TYPE_LABELS } from "@/domain/catalog";
import { cn } from "@/lib/utils";
import { LINE_TYPE_PARAMS } from "@/modules/catalog/schemas";

const ALL = "__toutes__";

export function CatalogToolbar({ categories }: { categories: string[] }) {
  const { searchParams, update, reset, pending } = useUrlFilters();
  const [resetKey, setResetKey] = useState(0);
  const hasFilters = ["q", "type", "categorie", "statut"].some((key) => searchParams.has(key));
  const select = (key: string, fallback: string) => ({
    value: searchParams.get(key) ?? fallback,
    onChange: (value: string) => update({ [key]: value === fallback ? null : value }),
  });

  return (
    <div className={cn("flex flex-col gap-2 md:flex-row md:flex-wrap", pending && "opacity-70")}>
      <SearchField
        label="Rechercher une prestation"
        placeholder="Rechercher une prestation…"
        initialValue={searchParams.get("q") ?? ""}
        onSearch={(q) => update({ q })}
        resetKey={resetKey}
      />
      <div className="grid grid-cols-2 gap-2 md:flex">
        <FilterSelect
          label="Type de ligne"
          {...select("type", ALL)}
          options={[
            { value: ALL, label: "Tous les types" },
            ...Object.entries(LINE_TYPE_PARAMS).map(([value, code]) => ({
              value,
              label: LINE_TYPE_LABELS[code],
            })),
          ]}
        />
        <FilterSelect
          label="Catégorie"
          {...select("categorie", ALL)}
          options={[
            { value: ALL, label: "Toutes les catégories" },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterSelect
          label="Statut"
          {...select("statut", "actives")}
          options={[
            { value: "actives", label: "Actives" },
            { value: "inactives", label: "Désactivées" },
            { value: "toutes", label: "Toutes" },
          ]}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setResetKey((key) => key + 1);
              reset();
            }}
          >
            <XIcon /> Effacer
          </Button>
        )}
      </div>
    </div>
  );
}
