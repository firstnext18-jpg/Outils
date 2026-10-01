"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { NewPasswordFields } from "@/components/forms/new-password-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { authClient } from "@/lib/auth-client";
import { newPasswordSchema } from "@/modules/users/schemas";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  async function onSubmit({ password }: z.output<typeof newPasswordSchema>) {
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setError(
        error.status === 429
          ? "Trop de tentatives. Patientez une minute, puis réessayez."
          : "Ce lien n'est plus valable. Demandez un nouveau lien de réinitialisation.",
      );
      return;
    }
    router.replace("/connexion?reinitialise=1");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Nouveau mot de passe</CardTitle>
        <CardDescription>Choisissez votre nouveau mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormError message={error} />
            <NewPasswordFields control={form.control} />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer le mot de passe"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
