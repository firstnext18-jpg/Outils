"use client";

import { CircleCheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError } from "@/components/forms/form-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fillLabel } from "@/i18n/documents";
import type { PortalLanguage, PortalTexts } from "@/i18n/portal";
import { portalLoginAction } from "@/modules/portal/actions";

export function PortalLoginForm({
  language,
  t,
  passwordReset,
  contact,
  links,
}: {
  language: PortalLanguage;
  t: PortalTexts;
  passwordReset: boolean;
  contact: string;
  links: { otherLanguage: string; forgot: string };
}) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!login.trim()) return setError(t.loginRequired);
    if (!password) return setError(t.passwordRequired);
    startTransition(async () => {
      const result = await portalLoginAction({ login, password, language });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/espace-client");
      router.refresh();
    });
  }

  return (
    <Card lang={language === "DE" ? "de" : "fr"}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-xl">{t.portalTitle}</CardTitle>
          <Link
            href={links.otherLanguage}
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            {t.otherLanguage}
          </Link>
        </div>
        <CardDescription>{t.loginDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {passwordReset && (
            <Alert>
              <CircleCheckIcon />
              <AlertDescription>{t.passwordResetDone}</AlertDescription>
            </Alert>
          )}
          <FormError message={error} />
          <div className="space-y-2">
            <Label htmlFor="portal-login">{t.login}</Label>
            <Input
              id="portal-login"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="portal-password">{t.password}</Label>
              <Link
                href={links.forgot}
                className="text-muted-foreground text-sm underline-offset-4 hover:underline"
              >
                {t.forgotPassword}
              </Link>
            </div>
            <Input
              id="portal-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              maxLength={128}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t.signingIn : t.signIn}
          </Button>
          {contact && (
            <p className="text-muted-foreground text-center text-xs">
              {fillLabel(t.noAccessHelp, { contact })}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
