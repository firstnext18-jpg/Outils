"use client";

import { MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { FormError } from "@/components/forms/form-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PortalLanguage, PortalTexts } from "@/i18n/portal";
import { portalForgotPasswordAction } from "@/modules/portal/actions";

export function PortalForgotForm({
  language,
  t,
  links,
}: {
  language: PortalLanguage;
  t: PortalTexts;
  links: { otherLanguage: string; login: string };
}) {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!value.trim()) return setError(t.loginOrEmailRequired);
    startTransition(async () => {
      const result = await portalForgotPasswordAction({ loginOrEmail: value, language });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <Card lang={language === "DE" ? "de" : "fr"}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-xl">{t.forgotTitle}</CardTitle>
          <Link
            href={links.otherLanguage}
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            {t.otherLanguage}
          </Link>
        </div>
        <CardDescription>{t.forgotHelp}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <Alert>
            <MailCheckIcon />
            <AlertDescription>{t.forgotSent}</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormError message={error} />
            <div className="space-y-2">
              <Label htmlFor="portal-forgot">{t.loginOrEmail}</Label>
              <Input
                id="portal-forgot"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                maxLength={200}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t.sending : t.sendLink}
            </Button>
          </form>
        )}
        <p className="text-center text-sm">
          <Link
            href={links.login}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            {t.backToLogin}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
