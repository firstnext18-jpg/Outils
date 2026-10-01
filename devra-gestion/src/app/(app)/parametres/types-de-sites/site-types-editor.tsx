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
import {
  createSiteTypeAction,
  deleteSiteTypeAction,
  moveSiteTypeAction,
  renameSiteTypeAction,
  setSiteTypeActiveAction,
} from "@/modules/site-types/actions";
import type { ActionResult } from "@/server/action";

type SiteTypeRow = { id: string; name: string; active: boolean; usage: number };

export function SiteTypesEditor({ siteTypes }: { siteTypes: SiteTypeRow[] }) {
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
            () => createSiteTypeAction({ name }),
            `« ${name} » ajouté.`,
            () => setNewName(""),
          );
        }}
      >
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Nouveau type de site"
          maxLength={50}
          aria-label="Nom du nouveau type de site"
        />
        <Button type="submit" disabled={pending || !newName.trim()}>
          <PlusIcon /> Ajouter
        </Button>
      </form>

      <ul className="divide-y rounded-lg border">
        {siteTypes.map((siteType, index) => (
          <li key={siteType.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className="flex">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Monter ${siteType.name}`}
                disabled={pending || index === 0}
                onClick={() => run(() => moveSiteTypeAction({ id: siteType.id, direction: "up" }))}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Descendre ${siteType.name}`}
                disabled={pending || index === siteTypes.length - 1}
                onClick={() =>
                  run(() => moveSiteTypeAction({ id: siteType.id, direction: "down" }))
                }
              >
                <ArrowDownIcon />
              </Button>
            </div>

            {editing?.id === siteType.id ? (
              <form
                className="flex flex-1 gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(
                    () => renameSiteTypeAction({ id: siteType.id, name: editing.name }),
                    "Type de site renommé.",
                    () => setEditing(null),
                  );
                }}
              >
                <Input
                  value={editing.name}
                  onChange={(event) => setEditing({ id: siteType.id, name: event.target.value })}
                  maxLength={50}
                  autoFocus
                  aria-label={`Nouveau nom pour ${siteType.name}`}
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
                <span
                  className={siteType.active ? "font-medium" : "text-muted-foreground line-through"}
                >
                  {siteType.name}
                </span>
                {!siteType.active && <Badge variant="outline">Désactivé</Badge>}
                <span className="text-muted-foreground text-sm">
                  {siteType.usage} client{siteType.usage > 1 ? "s" : ""}
                </span>
              </div>
            )}

            {editing?.id !== siteType.id && (
              <div className="flex items-center gap-1">
                <Switch
                  checked={siteType.active}
                  disabled={pending}
                  aria-label={`${siteType.name} proposé sur les fiches`}
                  onCheckedChange={(active) =>
                    run(() => setSiteTypeActiveAction({ id: siteType.id, active }))
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Renommer ${siteType.name}`}
                  disabled={pending}
                  onClick={() => setEditing({ id: siteType.id, name: siteType.name })}
                >
                  <PencilIcon />
                </Button>
                {siteType.usage === 0 && (
                  <ConfirmButton
                    size="icon-sm"
                    title={`Supprimer « ${siteType.name} » ?`}
                    description="Ce type de site n'est utilisé par aucun client."
                    confirmLabel="Supprimer"
                    destructive
                    disabled={pending}
                    onConfirm={() =>
                      run(() => deleteSiteTypeAction({ id: siteType.id }), "Type de site supprimé.")
                    }
                  >
                    <Trash2Icon />
                    <span className="sr-only">Supprimer {siteType.name}</span>
                  </ConfirmButton>
                )}
              </div>
            )}
          </li>
        ))}
        {siteTypes.length === 0 && (
          <li className="text-muted-foreground px-3 py-6 text-center text-sm">
            Aucun type de site.
          </li>
        )}
      </ul>
    </div>
  );
}
