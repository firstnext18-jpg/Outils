import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  accessPageTexts,
  companyContact,
  languageQuery,
  otherLanguageHref,
} from "@/app/espace-client/(acces)/language";
import { PortalLoginForm } from "@/app/espace-client/(acces)/connexion/login-form";
import { getPortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Espace client · Kundenportal" };

export default async function PortalLoginPage({
  searchParams,
}: PageProps<"/espace-client/connexion">) {
  if (await getPortalSession()) redirect("/espace-client");
  const { language, t } = await accessPageTexts(searchParams);
  const { reinitialise } = await searchParams;
  return (
    <PortalLoginForm
      language={language}
      t={t}
      passwordReset={reinitialise === "1"}
      contact={await companyContact()}
      links={{
        otherLanguage: otherLanguageHref("/espace-client/connexion", language),
        forgot: `/espace-client/mot-de-passe-oublie${languageQuery(language)}`,
      }}
    />
  );
}
