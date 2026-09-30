"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/forms/form-error";
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
import { updateDocumentTextsAction } from "@/modules/settings/actions";
import { documentTextsSchema, type DocumentTextsInput } from "@/modules/settings/schemas";

const SECTIONS: {
  title: string;
  description: string;
  fr: FieldPath<DocumentTextsInput>;
  de: FieldPath<DocumentTextsInput>;
  rows: number;
}[] = [
  {
    title: "Introduction des devis",
    description: "Texte placé avant les lignes du devis. Modifiable sur chaque devis.",
    fr: "quoteIntroFr",
    de: "quoteIntroDe",
    rows: 3,
  },
  {
    title: "Conditions des devis",
    description:
      "Texte placé après les montants (paiement, délais, validité…). Modifiable sur chaque devis.",
    fr: "quoteConditionsFr",
    de: "quoteConditionsDe",
    rows: 4,
  },
  {
    title: "Pied de page",
    description:
      "Une ligne au bas de chaque page des documents (facultatif), ex. « Merci de votre confiance ».",
    fr: "documentFooterFr",
    de: "documentFooterDe",
    rows: 2,
  },
];

export function DocumentTextsForm({ defaultValues }: { defaultValues: DocumentTextsInput }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<DocumentTextsInput>({
    resolver: zodResolver(documentTextsSchema),
    defaultValues,
  });

  async function onSubmit(values: DocumentTextsInput) {
    setError(null);
    const result = await updateDocumentTextsAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    form.reset(values);
    toast.success("Textes des documents enregistrés.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <FormError message={error} />
        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {(
                [
                  [section.fr, "Français"],
                  [section.de, "Allemand"],
                ] as const
              ).map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {section.title} — {label}
                      </FormLabel>
                      <FormControl>
                        <Textarea rows={section.rows} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
