import type { Metadata } from "next";
import Link from "next/link";
import { languageQuery } from "@/app/espace-client/(acces)/language";
import { PortalResetForm } from "@/app/espace-client/(acces)/reinitialiser/[jeton]/reset-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { portalTexts } from "@/i18n/portal";
import { findPasswordReset } from "@/modules/portal/auth";

// Le lien contient un jeton secret : il ne doit fuiter ni vers d'autres sites ni dans un moteur de recherche.
export const metadata: Metadata = {
  title: "Espace client · Kundenportal",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function PortalResetPage({
  params,
}: PageProps<"/espace-client/reinitialiser/[jeton]">) {
  const { jeton } = await params;
  const reset = await findPasswordReset(jeton);

  if (!reset) {
    // Lien inconnu : on ne connaît pas la langue du client, les deux sont affichées.
    return (
      <Card>
        <CardContent className="space-y-4 py-6 text-sm">
          {(["FR", "DE"] as const).map((language) => {
            const t = portalTexts(language);
            return (
              <div key={language} lang={language === "DE" ? "de" : "fr"} className="space-y-1">
                <p className="font-medium">{t.resetInvalid}</p>
                <Link
                  href={`/espace-client/mot-de-passe-oublie${languageQuery(language)}`}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  {t.newLink}
                </Link>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  const language = reset.account.client.language;
  const t = portalTexts(language);
  return (
    <Card lang={language === "DE" ? "de" : "fr"}>
      <CardHeader>
        <CardTitle className="text-xl">{t.resetTitle}</CardTitle>
        <CardDescription>
          {language === "DE" ? `${t.login}:` : `${t.login} :`}{" "}
          <span className="font-mono font-medium">{reset.account.login}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PortalResetForm token={jeton} language={language} t={t} />
      </CardContent>
    </Card>
  );
}
