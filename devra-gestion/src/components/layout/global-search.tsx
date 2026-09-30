"use client";

import { ArchiveIcon, SearchIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearchAction } from "@/modules/search/actions";

type Results = Awaited<ReturnType<typeof globalSearchAction>>;
type ClientHit = Extract<Results, { ok: true }>["data"]["clients"][number];

/** Recherche globale : bouton dans l'en-tête et raccourci Ctrl+K (⌘K sur Mac). */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientHit[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await globalSearchAction({ query: trimmed });
      // Ignore les réponses d'une frappe précédente arrivées en retard.
      if (id !== requestId.current) return;
      setLoading(false);
      setClients(result.ok ? result.data.clients : []);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setClients([]);
    router.push(href);
  }

  const trimmed = query.trim();

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground h-9 w-full justify-start gap-2 sm:w-64"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="bg-muted hidden rounded border px-1.5 font-mono text-xs sm:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setQuery("");
        }}
        title="Recherche globale"
        description="Rechercher un client"
        shouldFilter={false}
      >
        <CommandInput
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            if (!value.trim()) setClients([]);
          }}
          placeholder="Nom, localité, email…"
        />
        <CommandList>
          {trimmed && !loading && <CommandEmpty>Aucun résultat.</CommandEmpty>}
          {!trimmed && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Tapez un nom, une localité ou un email.
            </p>
          )}
          {trimmed && clients.length > 0 && (
            <CommandGroup heading="Clients">
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.id}
                  onSelect={() => go(`/clients/${client.id}`)}
                >
                  <UsersIcon />
                  <span className="flex-1 truncate">{client.displayName}</span>
                  {client.archivedAt && (
                    <ArchiveIcon className="text-muted-foreground" aria-label="Archivé" />
                  )}
                  <span className="text-muted-foreground truncate text-xs">
                    {client.city || client.email}
                  </span>
                </CommandItem>
              ))}
              <CommandItem
                value="__all__"
                onSelect={() => go(`/clients?q=${encodeURIComponent(trimmed)}&statut=tous`)}
              >
                <SearchIcon />
                Voir tous les clients correspondant à « {trimmed} »
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
