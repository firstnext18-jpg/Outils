"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormError } from "@/components/forms/form-error";
import { NewPasswordFields } from "@/components/forms/new-password-fields";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { acceptInvitationAction } from "@/modules/users/actions";
import { acceptInvitationSchema, type AcceptInvitationInput } from "@/modules/users/schemas";

export function AcceptInvitationForm({
  token,
  email,
  defaultName,
}: {
  token: string;
  email: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<AcceptInvitationInput>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { token, name: defaultName, password: "", passwordConfirm: "" },
  });

  async function onSubmit(values: AcceptInvitationInput) {
    setError(null);
    const result = await acceptInvitationAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Compte créé : connexion directe avec le mot de passe choisi.
    const { error: signInError } = await authClient.signIn.email({
      email: result.data.email,
      password: values.password,
    });
    router.replace(signInError ? "/connexion" : "/");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Activer votre compte</CardTitle>
        <CardDescription>Vérifiez votre nom et choisissez votre mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormError message={error} />
            <div className="space-y-2">
              <Label htmlFor="invitation-email">Email</Label>
              <Input
                id="invitation-email"
                value={email}
                readOnly
                disabled
                autoComplete="username"
              />
            </div>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom complet</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <NewPasswordFields control={form.control} />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Activation…" : "Activer mon compte"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
