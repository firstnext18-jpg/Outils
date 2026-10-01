"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_VARIABLE_DESCRIPTIONS, EMAIL_VARIABLES } from "@/domain/email-template";
import { updateEmailTemplatesAction } from "@/modules/settings/actions";
import { emailTemplatesSchema, type EmailTemplatesInput } from "@/modules/settings/schemas";

type Field = FieldPath<EmailTemplatesInput>;

const SECTIONS: {
  title: string;
  description: string;
  languages: { label: string; subject: Field; body: Field }[];
}[] = [
  {
    title: "Envoi d'un devis",
    description: "Proposé dans la fenêtre d'envoi d'un devis, selon la langue du devis.",
    languages: [
      { label: "Français", subject: "quoteEmailSubjectFr", body: "quoteEmailBodyFr" },
      { label: "Allemand", subject: "quoteEmailSubjectDe", body: "quoteEmailBodyDe" },
    ],
  },
  {
    title: "Envoi d'une facture",
    description: "Proposé dans la fenêtre d'envoi d'une facture, selon la langue de la facture.",
    languages: [
      { label: "Français", subject: "invoiceEmailSubjectFr", body: "invoiceEmailBodyFr" },
      { label: "Allemand", subject: "invoiceEmailSubjectDe", body: "invoiceEmailBodyDe" },
    ],
  },
];

export function EmailTemplatesForm({ defaultValues }: { defaultValues: EmailTemplatesInput }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EmailTemplatesInput>({
    resolver: zodResolver(emailTemplatesSchema),
    defaultValues,
  });

  async function onSubmit(values: EmailTemplatesInput) {
    setError(null);
    const result = await updateEmailTemplatesAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    form.reset(values);
    toast.success("Modèles d'emails enregistrés.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormError message={error} />
        <Card>
          <CardHeader>
            <CardTitle>Variables</CardTitle>
            <CardDescription>
              Remplacées à l&apos;envoi par les valeurs du document. Le message reste modifiable
              avant chaque envoi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              {EMAIL_VARIABLES.map((name) => (
                <div key={name} className="contents">
                  <dt>
                    <code className="bg-muted rounded px-1">{`{${name}}`}</code>
                  </dt>
                  <dd className="text-muted-foreground">{EMAIL_VARIABLE_DESCRIPTIONS[name]}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {section.languages.map((language) => (
                <div key={language.subject} className="space-y-3">
                  <TextField
                    control={form.control}
                    name={language.subject}
                    label={`Objet — ${language.label}`}
                    autoComplete="off"
                  />
                  <FormField
                    control={form.control}
                    name={language.body}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message — {language.label}</FormLabel>
                        <FormControl>
                          <Textarea rows={10} {...field} />
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

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
