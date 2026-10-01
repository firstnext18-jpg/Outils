"use client";

import { useDocumentForm } from "@/components/documents/editor/form-context";
import { DiscountInput } from "@/components/forms/discount-input";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

/** Remise globale ou acompte : valeur + « % » / « CHF ». */
export function DocumentDiscountField({
  valueName,
  typeName,
  label,
  help,
}: {
  valueName: "globalDiscountValue" | "depositValue";
  typeName: "globalDiscountType" | "depositType";
  label: string;
  help: string;
}) {
  const { control } = useDocumentForm();
  return (
    <FormField
      control={control}
      name={valueName}
      render={({ field, fieldState }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormField
            control={control}
            name={typeName}
            render={({ field: type }) => (
              <DiscountInput
                label={label}
                type={type.value ?? "PERCENT"}
                value={field.value ?? ""}
                onTypeChange={type.onChange}
                onValueChange={field.onChange}
                invalid={Boolean(fieldState.error)}
              />
            )}
          />
          <p className="text-muted-foreground text-xs">{help}</p>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
