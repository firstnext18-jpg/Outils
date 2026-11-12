import type { Metadata } from "next";
import {
  accessPageTexts,
  languageQuery,
  otherLanguageHref,
} from "@/app/espace-client/(acces)/language";
import { PortalForgotForm } from "@/app/espace-client/(acces)/mot-de-passe-oublie/forgot-form";

export const metadata: Metadata = { title: "Espace client · Kundenportal" };

export default async function PortalForgotPage({
  searchParams,
}: PageProps<"/espace-client/mot-de-passe-oublie">) {
  const { language, t } = await accessPageTexts(searchParams);
  return (
    <PortalForgotForm
      language={language}
      t={t}
      links={{
        otherLanguage: otherLanguageHref("/espace-client/mot-de-passe-oublie", language),
        login: `/espace-client/connexion${languageQuery(language)}`,
      }}
    />
  );
}
