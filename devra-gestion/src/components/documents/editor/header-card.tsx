"use client";

import { useState } from "react";
import { ClientPicker } from "@/components/documents/editor/client-picker";
import { useDocumentForm } from "@/components/documents/editor/form-context";
import { TextField } from "@/components/forms/text-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGE_LABELS } from "@/domain/clients";
import { addDays, isValidIsoDate } from "@/domain/dates";
import type { PickerClient } from "@/modules/clients/service";

const NONE = "__aucun__";

type Props = {
  client: PickerClient | null;
  onPickClient: (client: PickerClient) => void;
  onChangeLanguage: (language: "FR" | "DE") => void;
  siteTypes: { id: string; name: string }[];
  issueDateLabel: string;
  /** Seconde date : validité d'un devis ou échéance d'une facture. */
  secondDate: {
    name: "validUntil" | "dueDate";
    label: string;
    /** Nombre de jours ajoutés à la date du document tant que la seconde date n'a pas été modifiée. */
    offsetDays: number;
  };
  /** Document existant : la seconde date ne suit plus automatiquement. */
  existing: boolean;
};

/** Client, objet, dates, langue et type de site d'un devis ou d'une facture. */
export function DocumentHeaderCard({
  client,
  onPickClient,
  onChangeLanguage,
  siteTypes,
  issueDateLabel,
  secondDate,
  existing,
}: Props) {
  const { control, setValue } = useDocumentForm();
  const [secondTouched, setSecondTouched] = useState(existing);

  return (
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
                  onChange={onPickClient}
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
              <FormLabel>{issueDateLabel}</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  onChange={(event) => {
                    field.onChange(event);
                    const date = event.target.value;
                    if (!secondTouched && isValidIsoDate(date)) {
                      setValue(secondDate.name, addDays(date, secondDate.offsetDays));
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
          name={secondDate.name}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{secondDate.label}</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(event) => {
                    setSecondTouched(true);
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
                onValueChange={(value) => value && onChangeLanguage(value as "FR" | "DE")}
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
  );
}
