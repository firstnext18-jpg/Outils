"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormError } from "@/components/forms/form-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { authClient } from "@/lib/auth-client";
import { emailSchema } from "@/modules/users/schemas";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Saisissez votre mot de passe"),
});

export function LoginForm({ next, passwordReset }: { next: string; passwordReset: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof loginSchema>, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.output<typeof loginSchema>) {
    setError(null);
    const { error } = await authClient.signIn.email(values);
    if (error) {
      if (error.status === 429) {
        setError("Trop de tentatives de connexion. Patientez une minute, puis réessayez.");
      } else if (error.code === "FAILED_TO_CREATE_SESSION") {
        setError("Ce compte est désactivé. Contactez un administrateur.");
      } else {
        setError("Email ou mot de passe incorrect.");
      }
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>Accédez à l&apos;outil de gestion.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {passwordReset && (
              <Alert>
                <CircleCheckIcon />
                <AlertDescription>
                  Votre mot de passe a été modifié. Connectez-vous avec le nouveau.
                </AlertDescription>
              </Alert>
            )}
            <FormError message={error} />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="username" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Mot de passe</FormLabel>
                    <Link
                      href="/mot-de-passe-oublie"
                      className="text-muted-foreground text-sm underline-offset-4 hover:underline"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
