"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateQuoteReminderSettingsAction } from "@/modules/settings/actions";
import type { QuoteReminderSettingsInput } from "@/modules/settings/schemas";

/** Relance automatique des devis avant la fin de leur validité, et son modèle d'email. */
export function QuoteReminderForm({
  defaultValues,
}: {
  defaultValues: QuoteReminderSettingsInput;
}) {
  const [values, setValues] = useState(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<QuoteReminderSettingsInput>) =>
    setValues((v) => ({ ...v, ...patch }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relance des devis</CardTitle>
        <CardDescription>
          Un email au client quelques jours avant la fin de validité d&apos;un devis resté sans
          réponse (une seule fois, par la tâche quotidienne), PDF joint. Le bouton « Relancer le
          client » de chaque devis utilise le même modèle. Variables : {"{client}"}, {"{numero}"},{" "}
          {"{montant}"}, {"{echeance}"}, {"{lien}"} (lien d&apos;acceptation en ligne, ou de
          l&apos;espace client), {"{entreprise}"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await updateQuoteReminderSettingsAction(values);
              if (!result.ok) {
                setError(Object.values(result.fieldErrors ?? {})[0]?.[0] ?? result.error);
                return;
              }
              toast.success("Relance des devis enregistrée.");
            });
          }}
        >
          <FormError message={error} />
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={values.quoteReminderEnabled}
              onCheckedChange={(quoteReminderEnabled) => set({ quoteReminderEnabled })}
            />
            Relancer automatiquement les devis sans réponse
          </label>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="quote-reminder-days">Jours avant la fin de validité</Label>
            <Input
              id="quote-reminder-days"
              inputMode="numeric"
              value={values.quoteReminderDays}
              onChange={(event) => set({ quoteReminderDays: event.target.value })}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["Fr", "De"] as const).map((lang) => (
              <div key={lang} className="space-y-2">
                <Label htmlFor={`quote-reminder-subject-${lang}`}>
                  Objet ({lang === "Fr" ? "français" : "allemand"})
                </Label>
                <Input
                  id={`quote-reminder-subject-${lang}`}
                  value={values[`quoteReminderSubject${lang}`]}
                  onChange={(event) => set({ [`quoteReminderSubject${lang}`]: event.target.value })}
                />
                <Label htmlFor={`quote-reminder-body-${lang}`}>
                  Message ({lang === "Fr" ? "français" : "allemand"})
                </Label>
                <Textarea
                  id={`quote-reminder-body-${lang}`}
                  rows={9}
                  value={values[`quoteReminderBody${lang}`]}
                  onChange={(event) => set({ [`quoteReminderBody${lang}`]: event.target.value })}
                />
              </div>
            ))}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
