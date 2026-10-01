"use client";

import { useDocumentForm } from "@/components/documents/editor/form-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

/** Introduction et conditions du document. */
export function DocumentTextsCard() {
  const { control } = useDocumentForm();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Textes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(
          [
            ["introText", "Introduction", 3],
            ["conditionsText", "Conditions", 4],
          ] as const
        ).map(([fieldName, label, rows]) => (
          <FormField
            key={fieldName}
            control={control}
            name={fieldName}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                  <Textarea rows={rows} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </CardContent>
    </Card>
  );
}
