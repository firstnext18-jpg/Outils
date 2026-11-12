"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fillLabel } from "@/i18n/documents";
import type { PortalTexts } from "@/i18n/portal";
import { portalChangePasswordAction } from "@/modules/portal/actions";
import { PASSWORD_MIN_LENGTH } from "@/modules/users/schemas";

export function ChangePasswordForm({ t }: { t: PortalTexts }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!current) return setError(t.passwordRequired);
    if (password.length < PASSWORD_MIN_LENGTH) {
      return setError(fillLabel(t.passwordTooShort, { min: PASSWORD_MIN_LENGTH }));
    }
    if (password !== passwordConfirm) return setError(t.passwordMismatch);
    startTransition(async () => {
      const result = await portalChangePasswordAction({ current, password, passwordConfirm });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCurrent("");
      setPassword("");
      setPasswordConfirm("");
      toast.success(t.passwordChanged);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />
      <div className="space-y-2">
        <Label htmlFor="portal-current-password">{t.currentPassword}</Label>
        <Input
          id="portal-current-password"
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          maxLength={128}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="portal-new-password">{t.newPassword}</Label>
        <Input
          id="portal-new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          maxLength={128}
        />
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
      <Button type="submit" disabled={pending}>
        {pending ? t.saving : t.savePassword}
      </Button>
    </form>
  );
}
