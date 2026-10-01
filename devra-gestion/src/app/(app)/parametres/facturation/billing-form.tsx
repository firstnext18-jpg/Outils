"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatDocumentNumber, validateNumberFormat } from "@/domain/numbering";
import { updateBillingSettingsAction } from "@/modules/settings/actions";
import {
  billingSettingsSchema,
  type BillingSettingsInput,
  type BillingSettingsOutput,
} from "@/modules/settings/schemas";

type Counter = { last: string | null; next: string; nextValue: number };

export function BillingForm({
  defaultValues,
  counters,
}: {
  defaultValues: BillingSettingsInput;
  counters: { year: number; quote: Counter; invoice: Counter };
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<BillingSettingsInput, unknown, BillingSettingsOutput>({
    resolver: zodResolver(billingSettingsSchema),
    defaultValues,
  });
  const { control } = form;
  const rates = useWatch({ control, name: "vatRates" });
  const vatEnabled = useWatch({ control, name: "vatEnabled" });
  const quoteFormat = useWatch({ control, name: "quoteNumberFormat" });
  const invoiceFormat = useWatch({ control, name: "invoiceNumberFormat" });

  function preview(format: string, counter: Counter) {
    if (validateNumberFormat(format)) return "—";
    return formatDocumentNumber(format, counters.year, counter.nextValue);
  }

  async function onSubmit(_parsed: BillingSettingsOutput) {
    setError(null);
    const values = form.getValues();
    const result = await updateBillingSettingsAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(form.setError, result.fieldErrors);
      return;
    }
    toast.success("Paramètres de facturation enregistrés.");
    form.reset({ ...values, nextQuoteNumber: "", nextInvoiceNumber: "" });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormError message={error} />

        <Card>
          <CardHeader>
            <CardTitle>Numérotation</CardTitle>
            <CardDescription>
              Jetons : <code>{"{AAAA}"}</code> année, <code>{"{AA}"}</code> année sur 2 chiffres,{" "}
              <code>{"{NNN}"}</code> numéro dans l&apos;année (remis à 1 chaque 1er janvier). Les
              factures sont numérotées sans trou.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid items-start gap-6 md:grid-cols-2">
            {(
              [
                ["quoteNumberFormat", "nextQuoteNumber", "Devis", counters.quote, quoteFormat],
                [
                  "invoiceNumberFormat",
                  "nextInvoiceNumber",
                  "Factures",
                  counters.invoice,
                  invoiceFormat,
                ],
              ] as const
            ).map(([formatField, nextField, label, counter, format]) => (
              <div key={formatField} className="space-y-3">
                <TextField
                  control={control}
                  name={formatField}
                  label={`Format des ${label.toLowerCase()}`}
                  autoComplete="off"
                />
                <p className="text-muted-foreground text-sm">
                  {counter.last
                    ? `Dernier numéro ${counters.year} : ${counter.last}. `
                    : `Aucun numéro attribué en ${counters.year}. `}
                  Prochain :{" "}
                  <span className="text-foreground font-medium">{preview(format, counter)}</span>
                </p>
                <TextField
                  control={control}
                  name={nextField}
                  label={`Prochain numéro ${counters.year} (facultatif)`}
                  description="Pour continuer une numérotation commencée ailleurs. On ne peut qu'avancer."
                  inputMode="numeric"
                  placeholder={String(counter.nextValue)}
                  autoComplete="off"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Délais par défaut</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <TextField
              control={control}
              name="quoteValidityDays"
              label="Validité des devis (jours)"
              inputMode="numeric"
              autoComplete="off"
            />
            <TextField
              control={control}
              name="paymentTermDays"
              label="Délai de paiement des factures (jours)"
              inputMode="numeric"
              autoComplete="off"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acceptation des devis en ligne</CardTitle>
            <CardDescription>
              Le devis envoyé par email contient un lien sécurisé (variable {"{lien}"}) : le client
              y consulte le devis et l&apos;accepte (nom et case à cocher) ou le refuse. Le statut
              est mis à jour et l&apos;équipe est prévenue par email. L&apos;adresse de
              l&apos;application (APP_URL) doit être accessible depuis Internet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={control}
              name="onlineAcceptance"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Activer l&apos;acceptation en ligne</FormLabel>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TVA</CardTitle>
            <CardDescription>
              Tant que la TVA est désactivée, les documents portent la mention « Non soumis à la TVA
              ». Une fois activée, elle s&apos;applique aux nouveaux documents et aux brouillons
              enregistrés ensuite.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={control}
              name="vatEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Entreprise assujettie à la TVA</FormLabel>
                </FormItem>
              )}
            />
            {vatEnabled && (
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <TextField
                  control={control}
                  name="vatNumber"
                  label="Numéro TVA"
                  placeholder="CHE-123.456.789 TVA"
                  autoComplete="off"
                />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Taux (%)</p>
                  {rates.map((_, index) => (
                    <FormField
                      key={index}
                      control={control}
                      name={`vatRates.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <Input
                                {...field}
                                inputMode="decimal"
                                aria-label={`Taux ${index + 1}`}
                                className="w-28"
                              />
                            </FormControl>
                            <span className="text-muted-foreground text-sm">
                              %{index === 0 ? " (taux par défaut)" : ""}
                            </span>
                            {rates.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Retirer le taux ${index + 1}`}
                                onClick={() =>
                                  form.setValue(
                                    "vatRates",
                                    rates.filter((__, i) => i !== index),
                                  )
                                }
                              >
                                <XIcon />
                              </Button>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  {rates.length < 5 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => form.setValue("vatRates", [...rates, ""])}
                    >
                      <PlusIcon /> Ajouter un taux
                    </Button>
                  )}
                  <FormDescription>
                    Taux suisses : 8.1 (normal), 2.6 (réduit), 3.8 (hébergement).
                  </FormDescription>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
