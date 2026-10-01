"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { FormError } from "@/components/forms/form-error";
import { MoneyInput } from "@/components/forms/money-input";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  allowedUnits,
  LINE_TYPE_DESCRIPTIONS,
  LINE_TYPE_LABELS,
  LINE_TYPES,
  PERIODICITIES,
  PERIODICITY_LABELS,
  type LineTypeCode,
  type PeriodicityCode,
} from "@/domain/catalog";
import { UNIT_LABELS } from "@/domain/units";
import { cn } from "@/lib/utils";
import { createCatalogItemAction, updateCatalogItemAction } from "@/modules/catalog/actions";
import {
  catalogItemInputSchema,
  type CatalogItemData,
  type CatalogItemInput,
} from "@/modules/catalog/schemas";

export type CatalogDialogMode =
  | { kind: "create"; defaults: CatalogItemInput }
  | { kind: "edit"; id: string; version: number; defaults: CatalogItemInput };

/** Création / modification d'une prestation (fenêtre). */
export function CatalogItemDialog({
  mode,
  open,
  onOpenChange,
  categories,
}: {
  mode: CatalogDialogMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const categoryListId = useId();
  const form = useForm<CatalogItemInput, unknown, CatalogItemData>({
    resolver: zodResolver(catalogItemInputSchema),
    defaultValues: mode.defaults,
  });
  const { control, setValue, getValues } = form;
  const lineType = useWatch({ control, name: "lineType" });
  const periodicity = useWatch({ control, name: "periodicity" });
  const units = allowedUnits(lineType, lineType === "SUBSCRIPTION" ? periodicity : null);

  /** Garde une unité compatible quand le type ou la périodicité change. */
  function syncUnit(nextType: LineTypeCode, nextPeriodicity: PeriodicityCode | null) {
    const allowed = allowedUnits(nextType, nextPeriodicity);
    if (!allowed.includes(getValues("unit"))) setValue("unit", allowed[0]!);
  }

  async function onSubmit(parsed: CatalogItemData) {
    setError(null);
    // Le serveur revalide les données saisies (prix en texte) avec le même schéma.
    const item = getValues();
    const result =
      mode.kind === "edit"
        ? await updateCatalogItemAction({ id: mode.id, version: mode.version, item })
        : await createCatalogItemAction({ item });
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(form.setError, result.fieldErrors, "item.");
      return;
    }
    toast.success(
      mode.kind === "edit" ? "Prestation enregistrée." : `« ${parsed.name} » ajoutée au catalogue.`,
    );
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          form.reset(mode.defaults);
          setError(null);
        }
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode.kind === "edit" ? "Modifier la prestation" : "Nouvelle prestation"}
          </DialogTitle>
          <DialogDescription>
            Prix hors TVA. Les devis et factures gardent une copie de la ligne : modifier une
            prestation ne change pas les documents existants.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <FormError message={error} />

            <FormField
              control={control}
              name="lineType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de ligne</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={(value) => {
                        const next = value as LineTypeCode;
                        field.onChange(next);
                        let nextPeriodicity = getValues("periodicity");
                        if (next === "SUBSCRIPTION" && !nextPeriodicity) {
                          nextPeriodicity = "MONTHLY";
                          setValue("periodicity", nextPeriodicity);
                        }
                        syncUnit(next, next === "SUBSCRIPTION" ? nextPeriodicity : null);
                      }}
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      {LINE_TYPES.map((type) => (
                        <label
                          key={type}
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-md border p-3 text-sm",
                            field.value === type && "border-foreground",
                          )}
                        >
                          <RadioGroupItem
                            value={type}
                            aria-label={LINE_TYPE_LABELS[type]}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-medium">{LINE_TYPE_LABELS[type]}</span>
                            <span className="text-muted-foreground block">
                              {LINE_TYPE_DESCRIPTIONS[type]}
                            </span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {lineType === "SUBSCRIPTION" && (
              <FormField
                control={control}
                name="periodicity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Périodicité</FormLabel>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(value) => {
                        if (!value) return;
                        const next = value as PeriodicityCode;
                        field.onChange(next);
                        syncUnit("SUBSCRIPTION", next);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full sm:w-60">
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PERIODICITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PERIODICITY_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <TextField control={control} name="name" label="Nom" autoComplete="off" />
            <FormField
              control={control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (facultatif)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid items-start gap-4 sm:grid-cols-3">
              <FormField
                control={control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem className="sm:col-span-1">
                    <FormLabel>Prix unitaire</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="0.00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unité</FormLabel>
                    <Select
                      value={field.value}
                      // Radix peut envoyer une valeur vide quand la liste d'options change.
                      onValueChange={(value) => value && field.onChange(value)}
                      disabled={units.length === 1}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>{UNIT_LABELS[field.value]?.name}</SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {UNIT_LABELS[unit].name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <FormControl>
                      <Input
                        list={categoryListId}
                        autoComplete="off"
                        placeholder="ex. Options"
                        {...field}
                      />
                    </FormControl>
                    <datalist id={categoryListId}>
                      {categories.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <details
              className="group rounded-md border px-4 py-3"
              open={Boolean(mode.defaults.nameDe)}
            >
              <summary className="cursor-pointer text-sm font-medium">
                Version allemande (facultatif)
                <span className="text-muted-foreground block font-normal">
                  Utilisée sur les devis et factures en allemand ; sinon, le texte français est
                  repris.
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                <TextField
                  control={control}
                  name="nameDe"
                  label="Nom en allemand"
                  autoComplete="off"
                />
                <FormField
                  control={control}
                  name="descriptionDe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description en allemand</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </details>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
