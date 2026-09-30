"use client";

import { XIcon } from "lucide-react";
import { useState } from "react";
import { FilterSelect, SearchField, useUrlFilters } from "@/components/list-filters";
import { Button } from "@/components/ui/button";
import { CANTONS_BY_FR_NAME } from "@/domain/cantons";
import { cn } from "@/lib/utils";
import { CLIENT_SORTS, CLIENT_STATUS_FILTERS } from "@/modules/clients/schemas";

const ALL = "__tous__";
const FILTER_KEYS = ["q", "type", "canton", "site", "tag", "statut"] as const;

/** Barre de recherche et de filtres de la liste des clients. */
export function ClientsToolbar({
  siteTypes,
  tags,
}: {
  siteTypes: { id: string; name: string }[];
  tags: string[];
}) {
  const { searchParams, update, reset, pending } = useUrlFilters();
  const [resetKey, setResetKey] = useState(0);
  const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key));
  const select = (key: string, fallback: string) => ({
    value: searchParams.get(key) ?? fallback,
    onChange: (value: string) => update({ [key]: value === fallback ? null : value }),
  });

  return (
    <div className={cn("space-y-3", pending && "opacity-70 transition-opacity")}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchField
          label="Rechercher un client"
          placeholder="Rechercher un nom, une localité, un email…"
          initialValue={searchParams.get("q") ?? ""}
          onSearch={(q) => update({ q })}
          resetKey={resetKey}
        />
        <FilterSelect
          label="Trier par"
          {...select("tri", "nom")}
          options={Object.entries(CLIENT_SORTS).map(([value, { label }]) => ({ value, label }))}
          className="sm:w-44"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <FilterSelect
          label="Type"
          {...select("type", ALL)}
          options={[
            { value: ALL, label: "Tous les types" },
            { value: "particulier", label: "Particuliers" },
            { value: "entreprise", label: "Entreprises" },
          ]}
        />
        <FilterSelect
          label="Canton"
          {...select("canton", ALL)}
          options={[
            { value: ALL, label: "Tous les cantons" },
            ...CANTONS_BY_FR_NAME.map((c) => ({ value: c.code, label: c.fr })),
          ]}
        />
        <FilterSelect
          label="Type de site"
          {...select("site", ALL)}
          options={[
            { value: ALL, label: "Tous les types de site" },
            ...siteTypes.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        {tags.length > 0 && (
          <FilterSelect
            label="Tag"
            {...select("tag", ALL)}
            options={[
              { value: ALL, label: "Tous les tags" },
              ...tags.map((t) => ({ value: t, label: t })),
            ]}
          />
        )}
        <FilterSelect
          label="Statut"
          {...select("statut", "actifs")}
          options={Object.entries(CLIENT_STATUS_FILTERS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setResetKey((key) => key + 1);
              reset(["tri"]);
            }}
          >
            <XIcon /> Effacer les filtres
          </Button>
        )}
      </div>
    </div>
  );
}
