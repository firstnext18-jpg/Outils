"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ClientPicker } from "@/components/documents/editor/client-picker";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { DISCUSSION_TITLE_MAX, MESSAGE_MAX } from "@/domain/discussions";
import { createDiscussionAction } from "@/modules/discussions/actions";
import { createDiscussionSchema, type CreateDiscussionInput } from "@/modules/discussions/schemas";
import type { PickerClient } from "@/modules/clients/service";

export function NewDiscussionForm({ initialClient }: { initialClient: PickerClient | null }) {
  const router = useRouter();
  const [client, setClient] = useState<PickerClient | null>(initialClient);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CreateDiscussionInput>({
    resolver: zodResolver(createDiscussionSchema),
    defaultValues: { clientId: initialClient?.id ?? "", title: "", body: "" },
  });

  async function onSubmit(values: CreateDiscussionInput) {
    setError(null);
    const result = await createDiscussionAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(form.setError, result.fieldErrors);
      return;
    }
    router.push(`/discussions/${result.data.id}`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4" noValidate>
        <FormError message={error} />
        <FormField
          control={form.control}
          name="clientId"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Client</FormLabel>
              <FormControl>
                <ClientPicker
                  value={client}
                  invalid={Boolean(fieldState.error)}
                  onChange={(picked) => {
                    setClient(picked);
                    field.onChange(picked.id);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <TextField
          control={form.control}
          name="title"
          label="Sujet"
          placeholder="Ex. Choix du thème, budget du référencement…"
          maxLength={DISCUSSION_TITLE_MAX}
          autoComplete="off"
        />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea {...field} rows={6} maxLength={MESSAGE_MAX} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Envoi…" : "Démarrer la discussion"}
        </Button>
      </form>
    </Form>
  );
}
