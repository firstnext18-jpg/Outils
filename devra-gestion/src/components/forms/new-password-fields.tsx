"use client";

import type { Control, FieldValues, Path } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "@/modules/users/schemas";

/** Champs « nouveau mot de passe » + « confirmation » (invitation, réinitialisation). */
export function NewPasswordFields<
  T extends FieldValues & { password: string; passwordConfirm: string },
>({ control }: { control: Control<T> }) {
  return (
    <>
      <FormField
        control={control}
        name={"password" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nouveau mot de passe</FormLabel>
            <FormControl>
              <Input type="password" autoComplete="new-password" {...field} />
            </FormControl>
            <FormDescription>{PASSWORD_MIN_LENGTH} caractères minimum.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"passwordConfirm" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Confirmation</FormLabel>
            <FormControl>
              <Input type="password" autoComplete="new-password" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
