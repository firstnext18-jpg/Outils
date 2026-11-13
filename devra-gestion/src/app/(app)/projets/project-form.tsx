"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClientPicker } from "@/components/documents/editor/client-picker";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createProjectAction, updateProjectAction } from "@/modules/projects/actions";
import type { PickerClient } from "@/modules/clients/service";

export type ProjectFormValues = {
  clientId: string;
  name: string;
  description: string;
  startDate: string;
  dueDate: string;
  hourlyRate: string;
  budgetHours: string;
  showHoursToClient: boolean;
};

/** Création (avec les étapes proposées) ou modification d'un projet. */
export function ProjectForm({
  projectId,
  client: initialClient,
  defaultValues,
  defaultSteps,
  defaultRateLabel,
}: {
  projectId?: string;
  client: PickerClient | null;
  defaultValues: ProjectFormValues;
  defaultSteps?: string[];
  defaultRateLabel: string;
}) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [values, setValues] = useState(defaultValues);
  const [steps, setSteps] = useState(defaultSteps ?? []);
  const [newStep, setNewStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<ProjectFormValues>) => setValues((v) => ({ ...v, ...patch }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = projectId
        ? await updateProjectAction({ id: projectId, project: values })
        : await createProjectAction({ project: { ...values, steps } });
      if (!result.ok) {
        setError(Object.values(result.fieldErrors ?? {})[0]?.[0] ?? result.error);
        return;
      }
      toast.success(projectId ? "Projet enregistré." : "Projet créé.");
      router.push(`/projets/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={error} />
      <Card>
        <CardHeader>
          <CardTitle>Projet</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="project-client">Client</Label>
            <ClientPicker
              id="project-client"
              value={client}
              onChange={(picked) => {
                setClient(picked);
                set({ clientId: picked.id });
              }}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="project-name">Nom du projet</Label>
            <Input
              id="project-name"
              value={values.name}
              maxLength={120}
              placeholder="ex. Site vitrine 2027"
              onChange={(event) => set({ name: event.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="project-description">Description (visible par le client)</Label>
            <Textarea
              id="project-description"
              value={values.description}
              maxLength={2000}
              rows={3}
              onChange={(event) => set({ description: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-start">Début</Label>
            <Input
              id="project-start"
              type="date"
              value={values.startDate}
              onChange={(event) => set({ startDate: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-due">Échéance</Label>
            <Input
              id="project-due"
              type="date"
              value={values.dueDate}
              onChange={(event) => set({ dueDate: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-rate">Tarif horaire du projet (CHF, hors TVA)</Label>
            <Input
              id="project-rate"
              inputMode="decimal"
              value={values.hourlyRate}
              placeholder={defaultRateLabel}
              onChange={(event) => set({ hourlyRate: event.target.value })}
            />
            <p className="text-muted-foreground text-xs">Vide : tarif par défaut des paramètres.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-budget">Budget (heures, facultatif)</Label>
            <Input
              id="project-budget"
              inputMode="decimal"
              value={values.budgetHours}
              onChange={(event) => set({ budgetHours: event.target.value })}
            />
          </div>
          <label className="flex items-center gap-3 text-sm md:col-span-2">
            <Switch
              checked={values.showHoursToClient}
              onCheckedChange={(showHoursToClient) => set({ showHoursToClient })}
            />
            Montrer le temps passé au client dans son espace (l&apos;avancement est toujours
            visible)
          </label>
        </CardContent>
      </Card>

      {!projectId && (
        <Card>
          <CardHeader>
            <CardTitle>Étapes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="space-y-2" aria-label="Étapes du projet">
              {steps.map((step, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-6 text-right text-sm tabular-nums">
                    {index + 1}.
                  </span>
                  <Input
                    value={step}
                    maxLength={120}
                    aria-label={`Étape ${index + 1}`}
                    onChange={(event) =>
                      setSteps((all) => all.map((s, i) => (i === index ? event.target.value : s)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Retirer l'étape ${index + 1}`}
                    onClick={() => setSteps((all) => all.filter((_, i) => i !== index))}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <Input
                value={newStep}
                maxLength={120}
                placeholder="Nouvelle étape"
                aria-label="Nouvelle étape"
                onChange={(event) => setNewStep(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (newStep.trim()) {
                      setSteps((all) => [...all, newStep.trim()]);
                      setNewStep("");
                    }
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!newStep.trim()}
                onClick={() => {
                  setSteps((all) => [...all, newStep.trim()]);
                  setNewStep("");
                }}
              >
                <PlusIcon /> Ajouter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : projectId ? "Enregistrer" : "Créer le projet"}
      </Button>
    </form>
  );
}
