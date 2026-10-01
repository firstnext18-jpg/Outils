"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { searchClientsForPickerAction } from "@/modules/clients/actions";
import type { PickerClient } from "@/modules/clients/service";

/** Choix du client d'un devis, avec recherche côté serveur. */
export function ClientPicker({
  value,
  onChange,
  id,
  invalid,
}: {
  value: PickerClient | null;
  onChange: (client: PickerClient) => void;
  id?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<PickerClient[]>([]);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const current = ++requestId.current;
    const timer = setTimeout(async () => {
      const result = await searchClientsForPickerAction({ query });
      if (current === requestId.current && result.ok) setClients(result.data);
    }, 150);
    return () => clearTimeout(timer);
  }, [open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? value.displayName : "Choisir un client…"}
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Rechercher un client…"
          />
          <CommandList>
            <CommandEmpty>Aucun client trouvé.</CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.id}
                  onSelect={() => {
                    onChange(client);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(value?.id === client.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex-1 truncate">{client.displayName}</span>
                  {client.city && (
                    <span className="text-muted-foreground text-xs">{client.city}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
