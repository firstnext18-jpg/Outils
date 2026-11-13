"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LIST_ITEM_MAX, LIST_LABELS, type ListKind } from "@/domain/lists";
import {
  createListItemAction,
  deleteListItemAction,
  moveListItemAction,
  renameListItemAction,
  setListItemActiveAction,
} from "@/modules/lists/actions";
import type { ActionResult } from "@/server/action";

type ListItemRow = { id: string; name: string; active: boolean; usage: number };

/** Édition d'une liste des paramètres : ajout, ordre, renommage, désactivation, suppression. */
export function ListEditor({ kind, items }: { kind: ListKind; items: ListItemRow[] }) {
  const labels = LIST_LABELS[kind];
  const rows = items;
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  function run(
    action: () => Promise<ActionResult<null>>,
    success?: string,
    onSuccess?: () => void,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      onSuccess?.();
    });
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const name = newName.trim();
          if (!name) return;
          run(
            () => createListItemAction({ kind, name }),
            `« ${name} » ajouté.`,
            () => setNewName(""),
          );
        }}
      >
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={labels.placeholder}
          maxLength={LIST_ITEM_MAX}
          aria-label={`${labels.title} : ${labels.placeholder.toLowerCase()}`}
        />
        <Button type="submit" disabled={pending || !newName.trim()}>
          <PlusIcon /> Ajouter
        </Button>
      </form>

      <ul className="divide-y rounded-lg border">
        {rows.map((row, index) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="flex">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Monter ${row.name}`}
                disabled={pending || index === 0}
                onClick={() => run(() => moveListItemAction({ id: row.id, direction: "up" }))}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Descendre ${row.name}`}
                disabled={pending || index === rows.length - 1}
                onClick={() => run(() => moveListItemAction({ id: row.id, direction: "down" }))}
              >
                <ArrowDownIcon />
              </Button>
            </div>

            {editing?.id === row.id ? (
              <form
                className="flex flex-1 gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(
                    () => renameListItemAction({ id: row.id, name: editing.name }),
                    "Valeur renommée.",
                    () => setEditing(null),
                  );
                }}
              >
                <Input
                  value={editing.name}
                  onChange={(event) => setEditing({ id: row.id, name: event.target.value })}
                  maxLength={LIST_ITEM_MAX}
                  autoFocus
                  aria-label={`Nouveau nom pour ${row.name}`}
                  className="h-8"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  aria-label="Enregistrer le nom"
                  disabled={pending}
                >
                  <CheckIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Annuler"
                  onClick={() => setEditing(null)}
                >
                  <XIcon />
                </Button>
              </form>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className={row.active ? "font-medium" : "text-muted-foreground line-through"}>
                  {row.name}
                </span>
                {!row.active && <Badge variant="outline">Désactivé</Badge>}
                {kind !== "PROJECT_STEP" && (
                  <span className="text-muted-foreground text-sm">
                    utilisé{row.usage > 1 ? "s" : ""} {row.usage} fois
                  </span>
                )}
              </div>
            )}

            {editing?.id !== row.id && (
              <div className="flex items-center gap-1">
                <Switch
                  checked={row.active}
                  disabled={pending}
                  aria-label={`${row.name} proposé`}
                  onCheckedChange={(active) =>
                    run(() => setListItemActiveAction({ id: row.id, active }))
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Renommer ${row.name}`}
                  disabled={pending}
                  onClick={() => setEditing({ id: row.id, name: row.name })}
                >
                  <PencilIcon />
                </Button>
                {row.usage === 0 && (
                  <ConfirmButton
                    size="icon-sm"
                    title={`Supprimer « ${row.name} » ?`}
                    description="Cette valeur n'est utilisée nulle part."
                    confirmLabel="Supprimer"
                    destructive
                    disabled={pending}
                    onConfirm={() =>
                      run(() => deleteListItemAction({ id: row.id }), "Valeur supprimée.")
                    }
                  >
                    <Trash2Icon />
                    <span className="sr-only">Supprimer {row.name}</span>
                  </ConfirmButton>
                )}
              </div>
            )}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-muted-foreground px-3 py-6 text-center text-sm">Liste vide.</li>
        )}
      </ul>
    </div>
  );
}
