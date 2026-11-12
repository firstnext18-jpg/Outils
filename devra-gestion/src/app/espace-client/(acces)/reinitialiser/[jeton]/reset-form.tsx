"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fillLabel } from "@/i18n/documents";
import type { PortalLanguage, PortalTexts } from "@/i18n/portal";
import { portalResetPasswordAction } from "@/modules/portal/actions";
import { PASSWORD_MIN_LENGTH } from "@/modules/users/schemas";

export function PortalResetForm({
  token,
  language,
  t,
}: {
  token: string;
  language: PortalLanguage;
  t: PortalTexts;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      return setError(fillLabel(t.passwordTooShort, { min: PASSWORD_MIN_LENGTH }));
    }
    if (password !== passwordConfirm) return setError(t.passwordMismatch);
    startTransition(async () => {
      const result = await portalResetPasswordAction({
        token,
        password,
        passwordConfirm,
        language,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(
        `/espace-client/connexion?reinitialise=1&langue=${language === "DE" ? "de" : "fr"}`,
      );
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />
      <div className="space-y-2">
        <Label htmlFor="portal-new-password">{t.newPassword}</Label>
        <Input
          id="portal-new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          autoFocus
          maxLength={128}
        />
        <p className="text-muted-foreground text-xs">
          {fillLabel(t.passwordTooShort, { min: PASSWORD_MIN_LENGTH })}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="portal-confirm-password">{t.confirmPassword}</Label>
        <Input
          id="portal-confirm-password"
          type="password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          autoComplete="new-password"
          maxLength={128}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.saving : t.savePassword}
      </Button>
    </form>
  );
}
