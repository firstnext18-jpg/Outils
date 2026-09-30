"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CANTONS_BY_FR_NAME } from "@/domain/cantons";
import { cn } from "@/lib/utils";
import { CLIENT_SORTS, CLIENT_STATUS_FILTERS } from "@/modules/clients/schemas";

const ALL = "__tous__";
const FILTER_KEYS = ["q", "type", "canton", "site", "tag", "statut"] as const;

type Option = { value: string; label: string };

/** Barre de recherche et de filtres : tout est reflété dans l'URL (partageable, retour arrière). */
export function ClientsToolbar({
  siteTypes,
  tags,
}: {
  siteTypes: { id: string; name: string }[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page"); // nouveau filtre → retour à la première page
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onSearchChange(value: string) {
    setQuery(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => update({ q: value.trim() || null }), 300);
  }

  useEffect(() => () => clearTimeout(debounce.current), []);

  const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key));

  return (
    <div className={cn("space-y-3", pending && "opacity-70 transition-opacity")}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher un nom, une localité, un email…"
            className="pl-9"
            aria-label="Rechercher un client"
          />
        </div>
        <FilterSelect
          label="Trier par"
          value={searchParams.get("tri") ?? "nom"}
          onChange={(value) => update({ tri: value === "nom" ? null : value })}
          options={Object.entries(CLIENT_SORTS).map(([value, { label }]) => ({ value, label }))}
          className="sm:w-44"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
        <FilterSelect
          label="Type"
          value={searchParams.get("type") ?? ALL}
          onChange={(value) => update({ type: value === ALL ? null : value })}
          options={[
            { value: ALL, label: "Tous les types" },
            { value: "particulier", label: "Particuliers" },
            { value: "entreprise", label: "Entreprises" },
          ]}
        />
        <FilterSelect
          label="Canton"
          value={searchParams.get("canton") ?? ALL}
          onChange={(value) => update({ canton: value === ALL ? null : value })}
          options={[
            { value: ALL, label: "Tous les cantons" },
            ...CANTONS_BY_FR_NAME.map((c) => ({ value: c.code, label: c.fr })),
          ]}
        />
        <FilterSelect
          label="Type de site"
          value={searchParams.get("site") ?? ALL}
          onChange={(value) => update({ site: value === ALL ? null : value })}
          options={[
            { value: ALL, label: "Tous les types de site" },
            ...siteTypes.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
        {tags.length > 0 && (
          <FilterSelect
            label="Tag"
            value={searchParams.get("tag") ?? ALL}
            onChange={(value) => update({ tag: value === ALL ? null : value })}
            options={[
              { value: ALL, label: "Tous les tags" },
              ...tags.map((t) => ({ value: t, label: t })),
            ]}
          />
        )}
        <FilterSelect
          label="Statut"
          value={searchParams.get("statut") ?? "actifs"}
          onChange={(value) => update({ statut: value === "actifs" ? null : value })}
          options={Object.entries(CLIENT_STATUS_FILTERS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              const tri = searchParams.get("tri");
              startTransition(() => router.replace(tri ? `${pathname}?tri=${tri}` : pathname));
            }}
          >
            <XIcon /> Effacer les filtres
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn("w-full md:w-auto md:min-w-40", className)}>
        {/* Libellé explicite : visible dès le rendu serveur, avant le chargement du JavaScript. */}
        <SelectValue>{options.find((option) => option.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
