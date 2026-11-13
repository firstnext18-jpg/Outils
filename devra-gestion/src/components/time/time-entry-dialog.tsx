"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClientPicker } from "@/components/documents/editor/client-picker";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createTimeEntryAction, updateTimeEntryAction } from "@/modules/time/actions";
import type { PickerClient } from "@/modules/clients/service";

export type ProjectOption = { id: string; name: string; clientId: string };

export type TimeEntryValues = {
  clientId: string;
  projectId: string | null;
  date: string;
  duration: string;
  description: string;
  billable: boolean;
};

const NO_PROJECT = "__aucun__";

/**
 * Saisie (ou modification) de temps. Le client peut être imposé (page d'un
 * projet) ou choisi ; seuls les projets de ce client sont proposés.
 */
export function TimeEntryDialog({
  open,
  onOpenChange,
  entryId,
  initial,
  client: initialClient,
  projects,
  lockClient = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId?: string;
  initial: TimeEntryValues;
  client: PickerClient | null;
  projects: ProjectOption[];
  lockClient?: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [client, setClient] = useState(initialClient);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<TimeEntryValues>) => setValues((v) => ({ ...v, ...patch }));
  const clientProjects = projects.filter((p) => p.clientId === values.clientId);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = entryId
        ? await updateTimeEntryAction({ id: entryId, entry: values })
        : await createTimeEntryAction({ entry: values });
      if (!result.ok) {
        setError(Object.values(result.fieldErrors ?? {})[0]?.[0] ?? result.error);
        return;
      }
      toast.success(entryId ? "Saisie modifiée." : "Temps enregistré.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{entryId ? "Modifier la saisie" : "Saisir du temps"}</DialogTitle>
            <DialogDescription>Durée : 1:30, 1.5 (heures) ou 45 min.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          {!lockClient && (
            <div className="space-y-2">
              <Label htmlFor="time-client">Client</Label>
              <ClientPicker
                id="time-client"
                value={client}
                onChange={(picked) => {
                  setClient(picked);
                  set({ clientId: picked.id, projectId: null });
                }}
              />
            </div>
          )}
          {(clientProjects.length > 0 || values.projectId) && (
            <div className="space-y-2">
              <Label htmlFor="time-project">Projet</Label>
              <Select
                value={values.projectId ?? NO_PROJECT}
                onValueChange={(value) => set({ projectId: value === NO_PROJECT ? null : value })}
              >
                <SelectTrigger id="time-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>Sans projet</SelectItem>
                  {clientProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="time-date">Date</Label>
              <Input
                id="time-date"
                type="date"
                value={values.date}
                onChange={(event) => set({ date: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time-duration">Durée</Label>
              <Input
                id="time-duration"
                value={values.duration}
                placeholder="1:30"
                autoFocus
                onChange={(event) => set({ duration: event.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="time-description">Description</Label>
            <Input
              id="time-description"
              value={values.description}
              maxLength={500}
              placeholder="ex. Intégration de la page d'accueil"
              onChange={(event) => set({ description: event.target.value })}
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={values.billable} onCheckedChange={(billable) => set({ billable })} />
            Facturable
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
