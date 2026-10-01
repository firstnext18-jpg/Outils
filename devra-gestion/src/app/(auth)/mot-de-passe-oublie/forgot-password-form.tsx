"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { emailSchema } from "@/modules/users/schemas";

const schema = z.object({ email: emailSchema });

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: z.output<typeof schema>) {
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reinitialiser",
    });
    if (error) {
      setError(
        error.status === 429
          ? "Trop de demandes. Patientez quelques minutes, puis réessayez."
          : "La demande n'a pas pu être envoyée. Réessayez plus tard.",
      );
      return;
    }
    // Même message que le compte existe ou non : on ne révèle pas quelles
    // adresses ont un compte.
    setSentTo(email);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Mot de passe oublié</CardTitle>
        <CardDescription>
          Recevez par email un lien pour choisir un nouveau mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sentTo ? (
          <div className="flex gap-3 text-sm" role="status">
            <MailCheckIcon className="text-muted-foreground size-5 shrink-0" />
            <p>
              Si un compte existe pour <strong>{sentTo}</strong>, un email vient d&apos;être envoyé.
              Le lien est valable 1 heure.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormError message={error} />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Envoi…" : "Envoyer le lien"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter>
        <Link
          href="/connexion"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      </CardFooter>
    </Card>
  );
}
