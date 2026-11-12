import type { Metadata } from "next";
import { ChangePasswordForm } from "@/app/espace-client/(espace)/compte/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fillLabel } from "@/i18n/documents";
import { portalTexts } from "@/i18n/portal";
import { PASSWORD_MIN_LENGTH } from "@/modules/users/schemas";
import { requirePortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Mon compte · Mein Konto" };

export default async function PortalAccountPage() {
  const { client, account } = await requirePortalSession();
  const t = portalTexts(client.language);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{t.accountTitle}</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{client.displayName}</CardTitle>
            <CardDescription>{t.yourLogin}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-lg font-semibold">{account.login}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.changePassword}</CardTitle>
            <CardDescription>
              {fillLabel(t.changePasswordHelp, { min: PASSWORD_MIN_LENGTH })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm t={t} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
