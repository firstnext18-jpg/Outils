"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  CatalogPicker,
  type PickerCatalogItem,
} from "@/components/documents/editor/catalog-picker";
import { ClientPicker } from "@/components/documents/editor/client-picker";
import {
  EditorMobileBar,
  EditorSidebarButtons,
} from "@/components/documents/editor/submit-buttons";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { DiscountInput } from "@/components/forms/discount-input";
import { FormError } from "@/components/forms/form-error";
import { MoneyInput } from "@/components/forms/money-input";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PERIODICITIES,
  PERIODICITY_LABELS,
  PERIODICITY_UNIT,
  type PeriodicityCode,
} from "@/domain/catalog";
import { LANGUAGE_LABELS } from "@/domain/clients";
import { parseChfInput } from "@/domain/money";
import { parseQuantity } from "@/domain/quantity";
import { UNIT_LABELS } from "@/domain/units";
import { formatAmount, formatChf } from "@/lib/format";
import type { PickerClient } from "@/modules/clients/service";
import { previewDiscount } from "@/modules/documents/lines";
import {
  createSubscriptionAction,
  updateSubscriptionAction,
} from "@/modules/subscriptions/actions";
import { periodAmount } from "@/modules/subscriptions/amounts";
import {
  subscriptionInputSchema,
  type SubscriptionData,
  type SubscriptionInput,
  type SubscriptionItemInput,
} from "@/modules/subscriptions/schemas";

type Props = {
  defaults: SubscriptionInput;
  initialClient: PickerClient | null;
  catalog: PickerCatalogItem[];
  vatRate: number | null;
  /** Absent pour un nouvel abonnement. */
  existing?: { id: string; version: number; billed: boolean };
};

function emptyItem(vatRate: number | null): SubscriptionItemInput {
  return {
    catalogItemId: null,
    label: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    discountType: "PERCENT",
    discountValue: "",
    vatRateBps: vatRate,
  };
}

export function SubscriptionEditor({ defaults, initialClient, catalog, vatRate, existing }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<PickerClient | null>(initialClient);
  const form = useForm<SubscriptionInput, unknown, SubscriptionData>({
    resolver: zodResolver(subscriptionInputSchema),
    defaultValues: defaults,
  });
  const { control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const periodicity = useWatch({ control, name: "periodicity" });
  const unit = UNIT_LABELS[PERIODICITY_UNIT[periodicity]].FR.one;

  const parsed = items.map((item) => {
    const discount = previewDiscount(item.discountType, item.discountValue);
    return {
      quantityMilli: parseQuantity(item.quantity) ?? 0,
      unitPriceCents: parseChfInput(item.unitPrice) ?? 0,
      discountType: discount?.type ?? null,
      discountValue: discount?.value ?? 0,
      vatRateBps: null,
    };
  });
  const total = periodAmount(parsed);

  async function onSubmit() {
    setError(null);
    const subscription = form.getValues();
    const result = existing
      ? await updateSubscriptionAction({ id: existing.id, version: existing.version, subscription })
      : await createSubscriptionAction({ subscription });
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(form.setError, result.fieldErrors, "subscription.");
      return;
    }
    toast.success(existing ? "Abonnement enregistré." : "Abonnement créé.");
    router.push(`/abonnements/${result.data.id}`);
    router.refresh();
  }

  const submitLabel = form.formState.isSubmitting
    ? "Enregistrement…"
    : existing
      ? "Enregistrer"
      : "Créer l'abonnement";
  const cancelHref = existing ? `/abonnements/${existing.id}` : "/abonnements";
  const itemsError =
    form.formState.errors.items?.root?.message ?? form.formState.errors.items?.message;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="grid gap-6 lg:grid-cols-[1fr_20rem]"
      >
        <div className="min-w-0 space-y-6">
          <FormError message={error} />
          <Card>
            <CardHeader>
              <CardTitle>Abonnement</CardTitle>
            </CardHeader>
            <CardContent className="grid items-start gap-4 sm:grid-cols-2">
              <FormField
                control={control}
                name="clientId"
                render={({ fieldState }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Client</FormLabel>
                    <FormControl>
                      <ClientPicker
                        value={client}
                        invalid={Boolean(fieldState.error)}
                        onChange={(picked) => {
                          setClient(picked);
                          form.setValue("clientId", picked.id, {
                            shouldValidate: form.formState.isSubmitted,
                          });
                          if (!existing) form.setValue("language", picked.language);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <TextField
                control={control}
                name="label"
                label="Libellé"
                placeholder="ex. Hébergement + maintenance"
                className="sm:col-span-2"
                autoComplete="off"
              />
              <FormField
                control={control}
                name="periodicity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Périodicité</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v as PeriodicityCode)}
                      disabled={existing?.billed}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>{PERIODICITY_LABELS[field.value]}</SelectValue>
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
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de début</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled={existing?.billed} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Langue des factures</FormLabel>
                    <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>{LANGUAGE_LABELS[field.value]}</SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notes internes (facultatif)</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prestations facturées chaque {unit}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.length > 0 ? (
                <ol className="space-y-3">
                  {fields.map((field, index) => (
                    <li
                      key={field.id}
                      className="space-y-3 rounded-lg border p-3"
                      aria-label={`Prestation ${index + 1}`}
                    >
                      <div className="flex items-start gap-2">
                        <FormField
                          control={control}
                          name={`items.${index}.label`}
                          render={({ field: f }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  {...f}
                                  placeholder="Désignation"
                                  aria-label={`Désignation de la prestation ${index + 1}`}
                                  className="font-medium"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Retirer la prestation ${index + 1}`}
                          onClick={() => remove(index)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                      <FormField
                        control={control}
                        name={`items.${index}.description`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                {...f}
                                rows={1}
                                placeholder="Description (facultatif)"
                                aria-label={`Description de la prestation ${index + 1}`}
                                className="min-h-9 text-sm"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-[5rem_9rem_10rem_1fr] sm:items-end">
                        <FormField
                          control={control}
                          name={`items.${index}.quantity`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-muted-foreground text-xs">
                                Quantité
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...f}
                                  inputMode="decimal"
                                  aria-label={`Quantité de la prestation ${index + 1}`}
                                  className="text-right tabular-nums"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name={`items.${index}.unitPrice`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormLabel className="text-muted-foreground text-xs">
                                Prix par {unit}
                              </FormLabel>
                              <FormControl>
                                <MoneyInput
                                  value={f.value}
                                  onChange={f.onChange}
                                  onBlur={f.onBlur}
                                  aria-label={`Prix de la prestation ${index + 1}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name={`items.${index}.discountValue`}
                          render={({ field: f, fieldState }) => (
                            <FormItem>
                              <FormLabel className="text-muted-foreground text-xs">
                                Remise
                              </FormLabel>
                              <FormField
                                control={control}
                                name={`items.${index}.discountType`}
                                render={({ field: type }) => (
                                  <DiscountInput
                                    label={`Remise de la prestation ${index + 1}`}
                                    type={type.value}
                                    value={f.value}
                                    onTypeChange={type.onChange}
                                    onValueChange={f.onChange}
                                    invalid={Boolean(fieldState.error)}
                                  />
                                )}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <p className="col-span-2 text-right sm:col-span-1">
                          <span className="text-muted-foreground block text-xs">Par {unit}</span>
                          <span className="font-medium tabular-nums">
                            {formatChf(periodAmount(parsed[index] ? [parsed[index]] : []))}
                          </span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  Aucune prestation. Ajoutez un abonnement du catalogue ou une prestation libre.
                </p>
              )}
              {itemsError && <p className="text-destructive text-sm">{itemsError}</p>}
              <div className="flex flex-wrap gap-2">
                <CatalogPicker
                  items={catalog}
                  onPick={(item) =>
                    append({
                      ...emptyItem(vatRate),
                      catalogItemId: item.id,
                      label: (form.getValues("language") === "DE" && item.nameDe) || item.name,
                      description:
                        (form.getValues("language") === "DE" && item.descriptionDe) ||
                        item.description,
                      unitPrice: formatAmount(item.unitPriceCents),
                    })
                  }
                />
                <Button type="button" variant="ghost" onClick={() => append(emptyItem(vatRate))}>
                  <PlusIcon /> Prestation libre
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Montant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between gap-4 text-base font-semibold">
                <span>Par {unit}</span>
                <span className="tabular-nums" aria-label="Montant par période">
                  {formatChf(total)}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                Hors TVA. Une facture est générée au début de chaque période, à partir de la date de
                début (en brouillon, ou envoyée directement selon les paramètres).
              </p>
              <EditorSidebarButtons
                label={submitLabel}
                cancelHref={cancelHref}
                pending={form.formState.isSubmitting}
              />
            </CardContent>
          </Card>
        </div>

        <EditorMobileBar
          label={submitLabel}
          cancelHref={cancelHref}
          pending={form.formState.isSubmitting}
        />
      </form>
    </Form>
  );
}
