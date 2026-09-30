"use client";

import { PackageIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LINE_TYPE_LABELS,
  priceSuffix,
  type LineTypeCode,
  type PeriodicityCode,
} from "@/domain/catalog";
import type { UnitCode } from "@/domain/units";
import { formatChf } from "@/lib/format";

export type PickerCatalogItem = {
  id: string;
  name: string;
  nameDe: string;
  description: string;
  descriptionDe: string;
  category: string;
  lineType: LineTypeCode;
  periodicity: PeriodicityCode | null;
  unit: UnitCode;
  unitPriceCents: number;
};

/** Ajout d'une ou plusieurs prestations du catalogue (la fenêtre reste ouverte). */
export function CatalogPicker({
  items,
  onPick,
}: {
  items: PickerCatalogItem[];
  onPick: (item: PickerCatalogItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(0);
  const categories = [...new Set(items.map((item) => item.category || "Sans catégorie"))];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setAdded(0);
          setOpen(true);
        }}
      >
        <PackageIcon /> Ajouter depuis le catalogue
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Catalogue"
        description="Ajouter une prestation au devis"
      >
        <CommandInput placeholder="Rechercher une prestation…" />
        <CommandList>
          <CommandEmpty>Aucune prestation trouvée.</CommandEmpty>
          {categories.map((category) => (
            <CommandGroup key={category} heading={category}>
              {items
                .filter((item) => (item.category || "Sans catégorie") === category)
                .map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name} ${item.nameDe} ${item.category} ${item.id}`}
                    onSelect={() => {
                      onPick(item);
                      setAdded((count) => count + 1);
                    }}
                  >
                    <span className="flex-1 truncate">{item.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {LINE_TYPE_LABELS[item.lineType]}
                    </span>
                    <span className="text-xs whitespace-nowrap tabular-nums">
                      {formatChf(item.unitPriceCents)}
                      {priceSuffix(item.unit)}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-sm">
          <span role="status">
            {added > 0
              ? `${added} ligne${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}`
              : "Cliquez pour ajouter"}
          </span>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Terminé
          </Button>
        </div>
      </CommandDialog>
    </>
  );
}
