"use client";

import { useState } from "react";
import { FilterSelect, SearchField, useUrlFilters } from "@/components/list-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JOURNAL_CATEGORIES } from "@/domain/journal";
import { cn } from "@/lib/utils";

const ALL = "__tous__";

export function JournalToolbar({ users }: { users: { id: string; name: string }[] }) {
  const { searchParams, update, reset, pending } = useUrlFilters();
  // Change à chaque « Effacer les filtres » : vide les champs de saisie.
  const [resetKey, setResetKey] = useState(0);
  const filtered = ["utilisateur", "type", "du", "au", "q"].some((key) => searchParams.get(key));
  return (
    <div className={cn("flex flex-col gap-2 lg:flex-row lg:flex-wrap", pending && "opacity-70")}>
      <SearchField
        label="Rechercher dans le journal"
        placeholder="Numéro, client, email…"
        initialValue={searchParams.get("q") ?? ""}
        onSearch={(q) => update({ q: q || null })}
        resetKey={resetKey}
      />
      <FilterSelect
        label="Personne"
        value={searchParams.get("utilisateur") ?? ALL}
        onChange={(value) => update({ utilisateur: value === ALL ? null : value })}
        options={[
          { value: ALL, label: "Toutes les personnes" },
          ...users.map((user) => ({ value: user.id, label: user.name })),
        ]}
      />
      <FilterSelect
        label="Type"
        value={searchParams.get("type") ?? ALL}
        onChange={(value) => update({ type: value === ALL ? null : value })}
        options={[
          { value: ALL, label: "Tous les types" },
          ...Object.entries(JOURNAL_CATEGORIES).map(([value, category]) => ({
            value,
            label: category.label,
          })),
        ]}
      />
      <div className="flex items-center gap-2">
        <Input
          key={`du-${resetKey}`}
          type="date"
          aria-label="Du"
          className="w-auto"
          defaultValue={searchParams.get("du") ?? ""}
          onChange={(event) => update({ du: event.target.value || null })}
        />
        <span className="text-muted-foreground text-sm">au</span>
        <Input
          key={`au-${resetKey}`}
          type="date"
          aria-label="Au"
          className="w-auto"
          defaultValue={searchParams.get("au") ?? ""}
          onChange={(event) => update({ au: event.target.value || null })}
        />
      </div>
      {filtered && (
        <Button
          variant="ghost"
          onClick={() => {
            reset();
            setResetKey((key) => key + 1);
          }}
        >
          Effacer les filtres
        </Button>
      )}
    </div>
  );
}
