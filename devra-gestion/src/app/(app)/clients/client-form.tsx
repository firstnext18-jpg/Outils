"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2Icon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { CountryCombobox } from "@/components/forms/country-combobox";
import { FormError } from "@/components/forms/form-error";
import { TagInput } from "@/components/forms/tag-input";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CANTONS_BY_FR_NAME } from "@/domain/cantons";
import { LANGUAGE_LABELS } from "@/domain/clients";
import { cn } from "@/lib/utils";
import { createClientAction, updateClientAction } from "@/modules/clients/actions";
import { clientInputSchema, type ClientData, type ClientInput } from "@/modules/clients/schemas";

const NONE = "__aucun__";

type Props = {
  defaultValues: ClientInput;
  siteTypes: { id: string; name: string }[];
  tagSuggestions: string[];
  /** Absent pour une création. */
  existing?: { id: string; version: number };
};

export function ClientForm({ defaultValues, siteTypes, tagSuggestions, existing }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ClientInput, unknown, ClientData>({
    resolver: zodResolver(clientInputSchema),
    defaultValues,
  });
  const { control } = form;
  const kind = useWatch({ control, name: "kind" });
  const country = useWatch({ control, name: "country" });

  async function onSubmit(client: ClientData) {
    setError(null);
    const result = existing
      ? await updateClientAction({ ...existing, client })
      : await createClientAction({ client });
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(form.setError, result.fieldErrors, "client.");
      return;
    }
    toast.success(existing ? "Fiche client enregistrée." : "Client créé.");
    router.push(`/clients/${result.data.id}`);
    router.refresh();
  }

  const cancelHref = existing ? `/clients/${existing.id}` : "/clients";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormError message={error} />

        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Type de client</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-2 gap-2 sm:max-w-md"
                    >
                      {(
                        [
                          ["INDIVIDUAL", "Particulier", UserIcon],
                          ["COMPANY", "Entreprise", Building2Icon],
                        ] as const
                      ).map(([value, label, Icon]) => (
                        <label
                          key={value}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm",
                            field.value === value && "border-foreground",
                          )}
                        >
                          <RadioGroupItem value={value} aria-label={label} />
                          <Icon className="text-muted-foreground size-4" />
                          {label}
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
            {kind === "INDIVIDUAL" ? (
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <TextField control={control} name="firstName" label="Prénom" autoComplete="off" />
                <TextField control={control} name="lastName" label="Nom" autoComplete="off" />
              </div>
            ) : (
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <TextField
                  control={control}
                  name="companyName"
                  label="Raison sociale"
                  autoComplete="off"
                />
                <TextField
                  control={control}
                  name="contactName"
                  label="Personne de contact"
                  autoComplete="off"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adresse</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-6">
            <TextField
              control={control}
              name="street"
              label="Rue"
              className="sm:col-span-4"
              autoComplete="off"
            />
            <TextField
              control={control}
              name="streetNumber"
              label="Numéro"
              className="sm:col-span-2"
              autoComplete="off"
            />
            <TextField
              control={control}
              name="postalCode"
              label="NPA"
              className="sm:col-span-2"
              autoComplete="off"
            />
            <TextField
              control={control}
              name="city"
              label="Localité"
              className="sm:col-span-4"
              autoComplete="off"
            />
            <FormField
              control={control}
              name="country"
              render={({ field }) => (
                <FormItem className="sm:col-span-3">
                  <FormLabel>Pays</FormLabel>
                  <FormControl>
                    <CountryCombobox value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {country === "CH" && (
              <FormField
                control={control}
                name="canton"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>Canton</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(v) => v && field.onChange(v === NONE ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {CANTONS_BY_FR_NAME.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.fr} ({c.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <TextField
              control={control}
              name="email"
              label="Email"
              type="email"
              autoComplete="off"
            />
            <TextField
              control={control}
              name="phone"
              label="Téléphone"
              type="tel"
              autoComplete="off"
            />
            <TextField
              control={control}
              name="website"
              label="Site internet actuel"
              placeholder="exemple.ch"
              className="sm:col-span-2"
              autoComplete="off"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projet</CardTitle>
          </CardHeader>
          <CardContent className="grid items-start gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="siteTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de site demandé</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => v && field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Langue des documents</FormLabel>
                  <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="tags"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <TagInput
                      value={field.value}
                      onChange={field.onChange}
                      suggestions={tagSuggestions}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Informations utiles sur ce client…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="bg-background/95 sticky bottom-0 -mx-4 flex justify-end gap-2 border-t px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <Button asChild variant="ghost">
            <Link href={cancelHref}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Enregistrement…"
              : existing
                ? "Enregistrer"
                : "Créer le client"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
