"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { updateCompanySettingsAction } from "@/modules/settings/actions";
import {
  companySettingsSchema,
  type CompanySettingsInput,
  type CompanySettingsOutput,
} from "@/modules/settings/schemas";

export function CompanyForm({ defaultValues }: { defaultValues: CompanySettingsInput }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CompanySettingsInput, unknown, CompanySettingsOutput>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues,
  });
  const { control } = form;

  async function onSubmit(values: CompanySettingsOutput) {
    setError(null);
    const result = await updateCompanySettingsAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(form.setError, result.fieldErrors);
      return;
    }
    form.reset(values);
    toast.success("Informations de l'entreprise enregistrées.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormError message={error} />

        <div className="grid items-start gap-4 sm:grid-cols-6">
          <TextField
            control={control}
            name="companyName"
            label="Nom de l'entreprise"
            className="sm:col-span-6"
            autoComplete="organization"
          />
          <TextField
            control={control}
            name="companyStreet"
            label="Rue"
            className="sm:col-span-4"
            autoComplete="address-line1"
          />
          <TextField
            control={control}
            name="companyStreetNumber"
            label="Numéro"
            className="sm:col-span-2"
          />
          <TextField
            control={control}
            name="companyPostalCode"
            label="NPA"
            className="sm:col-span-2"
            autoComplete="postal-code"
          />
          <TextField
            control={control}
            name="companyCity"
            label="Localité"
            className="sm:col-span-3"
            autoComplete="address-level2"
          />
          <TextField
            control={control}
            name="companyCountry"
            label="Pays"
            description="Code à 2 lettres"
            className="sm:col-span-1"
            maxLength={2}
          />
        </div>

        <Separator />

        <div className="grid items-start gap-4 sm:grid-cols-2">
          <TextField
            control={control}
            name="companyEmail"
            label="Email"
            type="email"
            autoComplete="email"
          />
          <TextField
            control={control}
            name="companyPhone"
            label="Téléphone"
            type="tel"
            autoComplete="tel"
          />
          <TextField
            control={control}
            name="companyWebsite"
            label="Site internet"
            placeholder="devra.ch"
            className="sm:col-span-2"
          />
        </div>

        <Separator />

        <div className="grid items-start gap-4 sm:grid-cols-2">
          <TextField
            control={control}
            name="iban"
            label="IBAN"
            description="Compte classique : la QR-facture utilisera une référence SCOR."
            placeholder="CH00 0000 0000 0000 0000 0"
            autoComplete="off"
          />
          <TextField
            control={control}
            name="qrIban"
            label="QR-IBAN (facultatif)"
            description="Fourni par la banque sur demande : la QR-facture utilisera une référence QRR."
            placeholder="CH00 3000 0000 0000 0000 0"
            autoComplete="off"
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
