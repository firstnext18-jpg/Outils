"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { REMINDER_LEVEL_LABELS, REMINDER_LEVELS } from "@/domain/reminders";
import { updateReminderSettingsAction } from "@/modules/settings/actions";
import {
  reminderSettingsSchema,
  type ReminderSettingsInput,
  type ReminderSettingsOutput,
} from "@/modules/settings/schemas";

const DELAY_HELP = {
  1: "jours après l'échéance de la facture",
  2: "jours après le 1er rappel",
  3: "jours après le 2e rappel",
} as const;

export function ReminderSettingsForm({ defaultValues }: { defaultValues: ReminderSettingsInput }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ReminderSettingsInput, unknown, ReminderSettingsOutput>({
    resolver: zodResolver(reminderSettingsSchema),
    defaultValues,
  });

  async function onSubmit() {
    setError(null);
    // Le serveur revalide les valeurs saisies (textes) avec le même schéma.
    const values = form.getValues();
    const result = await updateReminderSettingsAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    form.reset(values);
    toast.success("Paramètres des relances enregistrés.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormError message={error} />
        <Card>
          <CardHeader>
            <CardTitle>Relances</CardTitle>
            <CardDescription>
              Trois niveaux : rappel, 2e rappel, mise en demeure. Chaque relance accorde un nouveau
              délai et contient une QR-facture du montant à payer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="reminderMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mode</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="gap-3"
                    >
                      <label className="flex items-start gap-3 text-sm">
                        <RadioGroupItem value="MANUAL" aria-label="Manuel" />
                        <span>
                          <span className="font-medium">Manuel</span> — l&apos;outil propose les
                          relances dues (Factures → Relances à envoyer), un utilisateur les valide.
                        </span>
                      </label>
                      <label className="flex items-start gap-3 text-sm">
                        <RadioGroupItem value="AUTOMATIC" aria-label="Automatique" />
                        <span>
                          <span className="font-medium">Automatique</span> — les relances dues
                          partent chaque matin par email.
                        </span>
                      </label>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid items-start gap-4 sm:grid-cols-3">
              {REMINDER_LEVELS.map((level) => (
                <div key={level} className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">{REMINDER_LEVEL_LABELS[level]}</p>
                  <TextField
                    control={form.control}
                    name={`reminderDelay${level}`}
                    label="Délai (jours)"
                    description={DELAY_HELP[level]}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  <TextField
                    control={form.control}
                    name={`reminderFee${level}Cents`}
                    label="Frais (CHF)"
                    placeholder="0.00"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
            <TextField
              control={form.control}
              name="reminderPaymentDays"
              label="Nouveau délai de paiement accordé (jours)"
              inputMode="numeric"
              autoComplete="off"
              className="sm:max-w-xs"
            />
          </CardContent>
        </Card>

        {REMINDER_LEVELS.map((level) => (
          <Card key={level}>
            <CardHeader>
              <CardTitle>Texte : {REMINDER_LEVEL_LABELS[level].toLowerCase()}</CardTitle>
              <CardDescription>
                Objet de l&apos;email, et texte utilisé à la fois dans l&apos;email et sur le PDF.
                Variables : {"{client}"}, {"{numero}"}, {"{date}"} (date de la facture),{" "}
                {"{montant}"} (à payer, frais compris), {"{echeance}"} (nouveau délai),{" "}
                {"{entreprise}"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {(["FR", "DE"] as const).map((language) => (
                <div key={language} className="space-y-3">
                  <TextField
                    control={form.control}
                    name={`reminderTemplates.level${level}.${language}.subject`}
                    label={`Objet — ${language === "FR" ? "Français" : "Allemand"}`}
                    autoComplete="off"
                  />
                  <FormField
                    control={form.control}
                    name={`reminderTemplates.level${level}.${language}.text`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texte — {language === "FR" ? "Français" : "Allemand"}</FormLabel>
                        <FormControl>
                          <Textarea rows={9} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Factures d&apos;abonnement</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="subscriptionAutoSend"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      Envoyer directement les factures d&apos;abonnement
                    </FormLabel>
                  </div>
                  <FormDescription>
                    Désactivé : elles sont générées en brouillon, à vérifier puis envoyer. Activé :
                    elles sont émises et envoyées par email (si le client a une adresse email).
                  </FormDescription>
                </FormItem>
              )}
            />
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
