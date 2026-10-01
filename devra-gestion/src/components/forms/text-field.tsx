"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

/** Champ texte d'un formulaire react-hook-form (libellé, aide, message d'erreur). */
export function TextField<T extends FieldValues, TTransformed = T>({
  control,
  name,
  label,
  description,
  className,
  ...inputProps
}: {
  control: Control<T, unknown, TTransformed>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...inputProps} {...field} value={field.value ?? ""} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
