"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import {
  TimeEntryDialog,
  type ProjectOption,
  type TimeEntryValues,
} from "@/components/time/time-entry-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { durationInput, formatDuration } from "@/domain/time";
import { deleteTimeEntryAction } from "@/modules/time/actions";
import type { PickerClient } from "@/modules/clients/service";

export type TimeEntryView = {
  id: string;
  date: string;
  dateLabel: string;
  minutes: number;
  description: string;
  billable: boolean;
  invoice: { id: string; number: string | null } | null;
  client: { id: string; displayName: string };
  project: { id: string; name: string } | null;
  user: string;
};

/**
 * Liste des saisies de temps, avec ajout, modification et suppression
 * (impossible une fois le temps facturé).
 */
export function TimeEntries({
  entries,
  projects,
  canEdit,
  today,
  fixed,
  showClient = true,
}: {
  entries: TimeEntryView[];
  projects: ProjectOption[];
  canEdit: boolean;
  today: string;
  /** Client et projet imposés (page d'un projet). */
  fixed?: { client: PickerClient; projectId: string };
  showClient?: boolean;
}) {
  const [dialog, setDialog] = useState<{
    entryId?: string;
    values: TimeEntryValues;
    client: PickerClient | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteTimeEntryAction({ id });
      if (result.ok) toast.success("Saisie supprimée.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setDialog({
              values: {
                clientId: fixed?.client.id ?? "",
                projectId: fixed?.projectId ?? null,
                date: today,
                duration: "",
                description: "",
                billable: true,
              },
              client: fixed?.client ?? null,
            })
          }
        >
          <PlusIcon /> Saisir du temps
        </Button>
      )}
      {entries.length > 0 ? (
        <ul className="divide-y rounded-md border" aria-label="Saisies de temps">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
              <span className="text-muted-foreground w-24 tabular-nums">{entry.dateLabel}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  {entry.description || (
                    <span className="text-muted-foreground">Sans description</span>
                  )}
                </div>
                <div className="text-muted-foreground text-xs">
                  {[showClient ? entry.client.displayName : null, entry.project?.name, entry.user]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {!entry.billable && <Badge variant="outline">Non facturable</Badge>}
              {entry.invoice && (
                <Badge variant="secondary" asChild>
                  <Link href={`/factures/${entry.invoice.id}`}>
                    Facturé{entry.invoice.number ? ` · ${entry.invoice.number}` : " (brouillon)"}
                  </Link>
                </Badge>
              )}
              <span className="w-16 text-right font-medium tabular-nums">
                {formatDuration(entry.minutes)}
              </span>
              {canEdit && !entry.invoice && (
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Modifier la saisie du ${entry.dateLabel}`}
                    onClick={() =>
                      setDialog({
                        entryId: entry.id,
                        values: {
                          clientId: entry.client.id,
                          projectId: entry.project?.id ?? null,
                          date: entry.date,
                          duration: durationInput(entry.minutes),
                          description: entry.description,
                          billable: entry.billable,
                        },
                        client: {
                          id: entry.client.id,
                          displayName: entry.client.displayName,
                          city: "",
                          language: "FR",
                          siteTypeId: null,
                        },
                      })
                    }
                  >
                    <PencilIcon />
                  </Button>
                  <ConfirmButton
                    size="icon-sm"
                    title="Supprimer cette saisie ?"
                    description={`${formatDuration(entry.minutes)} le ${entry.dateLabel}.`}
                    confirmLabel="Supprimer"
                    destructive
                    disabled={pending}
                    onConfirm={() => remove(entry.id)}
                  >
                    <Trash2Icon />
                    <span className="sr-only">Supprimer la saisie du {entry.dateLabel}</span>
                  </ConfirmButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          Aucun temps saisi.
        </p>
      )}
      {dialog && (
        <TimeEntryDialog
          key={dialog.entryId ?? "nouveau"}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          entryId={dialog.entryId}
          initial={dialog.values}
          client={dialog.client}
          projects={projects}
          lockClient={Boolean(fixed)}
        />
      )}
    </div>
  );
}
