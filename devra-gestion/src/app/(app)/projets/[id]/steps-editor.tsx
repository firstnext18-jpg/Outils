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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  addStepAction,
  deleteStepAction,
  moveStepAction,
  renameStepAction,
  toggleStepAction,
} from "@/modules/projects/actions";
import type { ActionResult } from "@/server/action";

export type StepView = { id: string; label: string; done: boolean; doneInfo: string | null };

/** Étapes du projet : cocher au fil du travail ; ajouter, renommer, déplacer, supprimer. */
export function StepsEditor({
  projectId,
  steps,
  canEdit,
}: {
  projectId: string;
  steps: StepView[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const [newStep, setNewStep] = useState("");

  function run(action: () => Promise<ActionResult<null>>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else onSuccess?.();
    });
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-1" aria-label="Étapes">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-2 rounded-md px-1 py-1.5">
            <Checkbox
              checked={step.done}
              disabled={!canEdit || pending}
              aria-label={step.done ? `Rouvrir « ${step.label} »` : `Terminer « ${step.label} »`}
              className="mt-0.5"
              onCheckedChange={(value) =>
                run(() => toggleStepAction({ id: step.id, done: value === true }))
              }
            />
            {editing?.id === step.id ? (
              <form
                className="flex flex-1 gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(
                    () => renameStepAction({ id: step.id, label: editing.label }),
                    () => setEditing(null),
                  );
                }}
              >
                <Input
                  value={editing.label}
                  maxLength={120}
                  autoFocus
                  aria-label={`Nouveau nom pour ${step.label}`}
                  className="h-8"
                  onChange={(event) => setEditing({ id: step.id, label: event.target.value })}
                />
                <Button type="submit" size="icon-sm" aria-label="Enregistrer" disabled={pending}>
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
              <div className="min-w-0 flex-1">
                <span className={cn("text-sm", step.done && "text-muted-foreground line-through")}>
                  {step.label}
                </span>
                {step.doneInfo && (
                  <div className="text-muted-foreground text-xs">{step.doneInfo}</div>
                )}
              </div>
            )}
            {canEdit && editing?.id !== step.id && (
              <div className="flex shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Monter ${step.label}`}
                  disabled={pending || index === 0}
                  onClick={() => run(() => moveStepAction({ id: step.id, direction: "up" }))}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Descendre ${step.label}`}
                  disabled={pending || index === steps.length - 1}
                  onClick={() => run(() => moveStepAction({ id: step.id, direction: "down" }))}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Renommer ${step.label}`}
                  disabled={pending}
                  onClick={() => setEditing({ id: step.id, label: step.label })}
                >
                  <PencilIcon />
                </Button>
                <ConfirmButton
                  size="icon-sm"
                  title={`Supprimer l'étape « ${step.label} » ?`}
                  description="Elle disparaît aussi de l'avancement affiché au client."
                  confirmLabel="Supprimer"
                  destructive
                  disabled={pending}
                  onConfirm={() => run(() => deleteStepAction({ id: step.id }))}
                >
                  <Trash2Icon />
                  <span className="sr-only">Supprimer {step.label}</span>
                </ConfirmButton>
              </div>
            )}
          </li>
        ))}
        {steps.length === 0 && <li className="text-muted-foreground text-sm">Aucune étape.</li>}
      </ol>
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const label = newStep.trim();
            if (label)
              run(
                () => addStepAction({ projectId, label }),
                () => setNewStep(""),
              );
          }}
        >
          <Input
            value={newStep}
            maxLength={120}
            placeholder="Nouvelle étape"
            aria-label="Nouvelle étape"
            onChange={(event) => setNewStep(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={pending || !newStep.trim()}>
            <PlusIcon /> Ajouter
          </Button>
        </form>
      )}
    </div>
  );
}
