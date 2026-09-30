"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { CatalogPicker, type PickerCatalogItem } from "@/app/(app)/devis/catalog-picker";
import { ClientPicker } from "@/app/(app)/devis/client-picker";
import { QuoteLineRow } from "@/app/(app)/devis/quote-line-row";
import { TotalsSummary } from "@/components/documents/totals-summary";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { DiscountInput } from "@/components/forms/discount-input";
import { FormError } from "@/components/forms/form-error";
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
import { LANGUAGE_LABELS } from "@/domain/clients";
import { addDays, isValidIsoDate } from "@/domain/dates";
import { computeTotals } from "@/domain/totals";
import type { PickerClient } from "@/modules/clients/service";
import { createQuoteAction, updateQuoteAction } from "@/modules/quotes/actions";
import { emptyLine, lineFromCatalog, previewTotalsInput } from "@/modules/quotes/form";
import { quoteInputSchema, type QuoteData, type QuoteInput } from "@/modules/quotes/schemas";
import type { QuoteEditorSettings } from "@/modules/settings/documents";

const NONE = "__aucun__";

type Props = {
  defaults: QuoteInput;
  initialClient: PickerClient | null;
  settings: QuoteEditorSettings;
  catalog: PickerCatalogItem[];
  siteTypes: { id: string; name: string }[];
  /** Absent pour un nouveau devis. */
  existing?: { id: string; version: number; number: string };
};

export function QuoteEditor({
  defaults,
  initialClient,
  settings,
  catalog,
  siteTypes,
  existing,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<PickerClient | null>(initialClient);
  const [validUntilTouched, setValidUntilTouched] = useState(Boolean(existing));
  const form = useForm<QuoteInput, unknown, QuoteData>({
    resolver: zodResolver(quoteInputSchema),
    defaultValues: defaults,
  });
  const { control, setValue, getValues } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: "lines" });
  const values = useWatch({ control }) as QuoteInput;

  // Mêmes calculs que le serveur, pour afficher les montants pendant la saisie.
  const totals = useMemo(
    () => computeTotals({ ...previewTotalsInput(values), vatEnabled: settings.vatEnabled }),
    [values, settings.vatEnabled],
  );
  const preview = previewTotalsInput(values);

  /** Change la langue ; les textes encore « par défaut » suivent la nouvelle langue. */
  function changeLanguage(next: "FR" | "DE") {
    const previous = getValues("language");
    if (previous === next) return;
    setValue("language", next, { shouldDirty: true });
    const from = settings.texts[previous];
    const to = settings.texts[next];
    const intro = getValues("introText");
    if (!intro.trim() || intro === from.intro) setValue("introText", to.intro);
    const conditions = getValues("conditionsText");
    if (!conditions.trim() || conditions === from.conditions)
      setValue("conditionsText", to.conditions);
  }

  function pickClient(picked: PickerClient) {
    setClient(picked);
    setValue("clientId", picked.id, { shouldValidate: form.formState.isSubmitted });
    changeLanguage(picked.language);
    if (!getValues("siteTypeId") && picked.siteTypeId) setValue("siteTypeId", picked.siteTypeId);
  }

  async function onSubmit() {
    setError(null);
    // Le serveur revalide les données saisies (textes) avec le même schéma.
    const quote = getValues();
    const result = existing
      ? await updateQuoteAction({ id: existing.id, version: existing.version, quote })
      : await createQuoteAction({ quote });
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(form.setError, result.fieldErrors, "quote.");
      return;
    }
    toast.success(existing ? `Devis ${existing.number} enregistré.` : "Devis créé.");
    router.push(`/devis/${result.data.id}`);
    router.refresh();
  }

  const linesError =
    form.formState.errors.lines?.root?.message ?? form.formState.errors.lines?.message;
  const submitLabel = form.formState.isSubmitting
    ? "Enregistrement…"
    : existing
      ? "Enregistrer"
      : "Créer le devis";

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
              <CardTitle>Client et informations</CardTitle>
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
                        onChange={pickClient}
                        invalid={Boolean(fieldState.error)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <TextField
                control={control}
                name="subject"
                label="Objet (facultatif)"
                placeholder="ex. Création de votre site vitrine"
                className="sm:col-span-2"
                autoComplete="off"
              />
              <FormField
                control={control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date du devis</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          const date = event.target.value;
                          if (!validUntilTouched && isValidIsoDate(date)) {
                            setValue("validUntil", addDays(date, settings.quoteValidityDays));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valable jusqu&apos;au</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onChange={(event) => {
                          setValidUntilTouched(true);
                          field.onChange(event);
                        }}
                      />
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
                    <FormLabel>Langue du document</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => value && changeLanguage(value as "FR" | "DE")}
                    >
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
                name="siteTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de site</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(v) => v && field.onChange(v === NONE ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {siteTypes.find((t) => t.id === field.value)?.name ?? "—"}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {siteTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lignes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.length > 0 ? (
                <ol className="space-y-3">
                  {fields.map((field, index) => (
                    <QuoteLineRow
                      key={field.id}
                      index={index}
                      count={fields.length}
                      control={control}
                      setValue={setValue}
                      getValues={getValues}
                      netCents={totals.lines[index]?.netCents ?? 0}
                      vatEnabled={settings.vatEnabled}
                      vatRates={settings.vatRates}
                      onMove={move}
                      onRemove={() => remove(index)}
                    />
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  Aucune ligne. Ajoutez une prestation du catalogue ou une ligne libre.
                </p>
              )}
              {linesError && <p className="text-destructive text-sm">{linesError}</p>}
              <div className="flex flex-wrap gap-2">
                <CatalogPicker
                  items={catalog}
                  onPick={(item) =>
                    append(lineFromCatalog(item, getValues("language"), settings.defaultVatRate))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => append(emptyLine(settings.defaultVatRate))}
                >
                  <PlusIcon /> Ligne libre
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Textes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  ["introText", "Introduction", 3],
                  ["conditionsText", "Conditions", 4],
                ] as const
              ).map(([fieldName, label, rows]) => (
                <FormField
                  key={fieldName}
                  control={control}
                  name={fieldName}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <Textarea rows={rows} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Montants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <TotalsSummary
                totals={totals}
                globalDiscount={preview.globalDiscount}
                deposit={preview.deposit}
                vatEnabled={settings.vatEnabled}
              />
              {(
                [
                  [
                    "globalDiscountValue",
                    "globalDiscountType",
                    "Remise globale",
                    "S'ajoute aux remises de ligne ; ne s'applique pas aux abonnements.",
                  ],
                  [
                    "depositValue",
                    "depositType",
                    "Acompte à la commande",
                    "Calculé sur le montant unique, arrondi aux 5 centimes.",
                  ],
                ] as const
              ).map(([valueField, typeField, label, help]) => (
                <FormField
                  key={valueField}
                  control={control}
                  name={valueField}
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormField
                        control={control}
                        name={typeField}
                        render={({ field: type }) => (
                          <DiscountInput
                            label={label}
                            type={type.value}
                            value={field.value}
                            onTypeChange={type.onChange}
                            onValueChange={field.onChange}
                            invalid={Boolean(fieldState.error)}
                          />
                        )}
                      />
                      <p className="text-muted-foreground text-xs">{help}</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <div className="hidden gap-2 lg:flex">
                <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                  {submitLabel}
                </Button>
              </div>
              <Button asChild variant="ghost" className="hidden w-full lg:flex">
                <Link href={existing ? `/devis/${existing.id}` : "/devis"}>Annuler</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="bg-background/95 sticky bottom-0 -mx-4 flex justify-end gap-2 border-t px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:hidden">
          <Button asChild variant="ghost">
            <Link href={existing ? `/devis/${existing.id}` : "/devis"}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
