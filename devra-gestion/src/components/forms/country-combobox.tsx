"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRY_OPTIONS, countryName } from "@/domain/countries";
import { cn } from "@/lib/utils";

/** Choix du pays avec recherche (pays fréquents en premier). */
export function CountryCombobox({
  value,
  onChange,
  id,
  ...props
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const frequent = COUNTRY_OPTIONS.filter((c) => c.frequent);
  const others = COUNTRY_OPTIONS.filter((c) => !c.frequent);

  function item(country: (typeof COUNTRY_OPTIONS)[number]) {
    return (
      <CommandItem
        key={country.code}
        value={`${country.name} ${country.code}`}
        onSelect={() => {
          onChange(country.code);
          setOpen(false);
        }}
      >
        <CheckIcon className={cn(country.code === value ? "opacity-100" : "opacity-0")} />
        {country.name}
      </CommandItem>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          {...props}
        >
          {countryName(value)}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un pays…" />
          <CommandList>
            <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
            <CommandGroup>{frequent.map(item)}</CommandGroup>
            <CommandSeparator />
            <CommandGroup>{others.map(item)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
