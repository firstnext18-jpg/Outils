"use client";

import { BanknoteIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaymentForm } from "@/components/documents/payment-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatIsoDate } from "@/domain/dates";
import { normalizeSearchText, searchWords } from "@/domain/search";
import { formatChf } from "@/lib/format";

export type OpenInvoiceOption = {
  id: string;
  number: string;
  client: string;
  dueDate: string;
  balanceCents: number;
};

/** Raccourci « Enregistrer un paiement » : choix de la facture, puis le formulaire habituel. */
export function PaymentShortcut({ invoices }: { invoices: OpenInvoiceOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OpenInvoiceOption | null>(null);
  const [query, setQuery] = useState("");
  // Recherche par mots (numéro, client), sans accents : la recherche approximative
  // par défaut confondrait « F-2020-003 » et « F-2026-003 ».
  const words = searchWords(query);
  const matches = invoices.filter((invoice) => {
    const text = normalizeSearchText(`${invoice.number} ${invoice.client}`);
    return words.every((word) => text.includes(word));
  });

  function onOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setSelected(null);
      setQuery("");
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BanknoteIcon /> Enregistrer un paiement
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
            <DialogDescription>
              {selected
                ? `Facture ${selected.number} · ${selected.client} · solde ${formatChf(selected.balanceCents)}`
                : "Choisissez la facture payée."}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <PaymentForm
              key={selected.id}
              invoice={selected}
              cancelLabel="Retour"
              onCancel={() => setSelected(null)}
              onDone={() => {
                onOpenChange(false);
                router.refresh();
              }}
            />
          ) : (
            <Command className="rounded-md border" shouldFilter={false}>
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Numéro de facture ou client…"
              />
              <CommandList className="max-h-72">
                <CommandEmpty>
                  {invoices.length === 0
                    ? "Aucune facture en attente de paiement."
                    : "Aucune facture trouvée."}
                </CommandEmpty>
                <CommandGroup>
                  {matches.map((invoice) => (
                    <CommandItem
                      key={invoice.id}
                      value={invoice.id}
                      onSelect={() => setSelected(invoice)}
                      className="flex items-start justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="font-medium tabular-nums">{invoice.number}</span>
                        <span className="text-muted-foreground"> · {invoice.client}</span>
                        <span className="text-muted-foreground block text-xs">
                          Échéance {formatIsoDate(invoice.dueDate)}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatChf(invoice.balanceCents)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
