"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateProjectSiteSettingsAction } from "@/modules/settings/actions";
import type { ProjectSiteSettingsInput } from "@/modules/settings/schemas";

export function ProjectSiteSettingsForm({
  defaultValues,
}: {
  defaultValues: ProjectSiteSettingsInput;
}) {
  const [values, setValues] = useState(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateProjectSiteSettingsAction(values);
      if (!result.ok) {
        setError(Object.values(result.fieldErrors ?? {})[0]?.[0] ?? result.error);
        return;
      }
      toast.success("Paramètres enregistrés.");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={error} />
      <Card>
        <CardHeader>
          <CardTitle>Suivi du temps</CardTitle>
          <CardDescription>
            Tarif utilisé pour facturer le temps passé, sauf si le projet a son propre tarif.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-xs space-y-2">
          <Label htmlFor="hourly-rate">Tarif horaire par défaut (CHF, hors TVA)</Label>
          <Input
            id="hourly-rate"
            inputMode="decimal"
            placeholder="ex. 120.00"
            value={values.hourlyRate}
            onChange={(event) => setValues({ ...values, hourlyRate: event.target.value })}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sites des clients</CardTitle>
          <CardDescription>
            Rappels de renouvellement des domaines, hébergements et certificats, et alertes de la
            surveillance (notifications aux appareils de l&apos;équipe).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="renewal-days">Rappel des renouvellements (jours avant)</Label>
            <Input
              id="renewal-days"
              inputMode="numeric"
              value={values.renewalReminderDays}
              onChange={(event) =>
                setValues({ ...values, renewalReminderDays: event.target.value })
              }
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={values.monitorAlertEmail}
              onCheckedChange={(monitorAlertEmail) => setValues({ ...values, monitorAlertEmail })}
            />
            Envoyer aussi les alertes et les rappels par email à l&apos;équipe (admins et membres)
          </label>
        </CardContent>
      </Card>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
