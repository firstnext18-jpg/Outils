"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Filtres de liste reflétés dans l'URL : la vue est partageable et le bouton
 * « retour » du navigateur fonctionne.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

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

  /** Efface tous les filtres, sauf ceux listés dans `keep` (ex. le tri). */
  function reset(keep: string[] = []) {
    const params = new URLSearchParams();
    for (const key of keep) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  return { searchParams, update, reset, pending };
}

/** Champ de recherche : met à jour le paramètre `q` après une courte pause de frappe. */
export function SearchField({
  label,
  placeholder,
  onSearch,
  initialValue,
  resetKey,
}: {
  label: string;
  placeholder: string;
  onSearch: (value: string | null) => void;
  initialValue: string;
  /** Change quand les filtres sont effacés, pour vider le champ. */
  resetKey?: number;
}) {
  const [query, setQuery] = useState(initialValue);
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setQuery("");
  }

  useEffect(() => () => clearTimeout(debounce.current), []);

  return (
    <div className="relative flex-1">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          clearTimeout(debounce.current);
          debounce.current = setTimeout(() => onSearch(value.trim() || null), 300);
        }}
        placeholder={placeholder}
        className="pl-9"
        aria-label={label}
      />
    </div>
  );
}

export type FilterOption = { value: string; label: string };

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
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
