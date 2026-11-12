import "server-only";
import { headers } from "next/headers";
import { loginLanguage, portalTexts } from "@/i18n/portal";
import { getSettings } from "@/modules/settings/service";

/** Langue et textes d'une page de connexion (?langue=de, sinon langue du navigateur). */
export async function accessPageTexts(searchParams: Promise<Record<string, unknown>>) {
  const { langue } = await searchParams;
  const language = loginLanguage(langue, (await headers()).get("accept-language"));
  return { language, t: portalTexts(language) };
}

/** Coordonnées de l'entreprise (Paramètres → Entreprise), pour « Contactez-nous ». */
export async function companyContact(): Promise<string> {
  const settings = await getSettings();
  return [settings.companyEmail, settings.companyPhone]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" · ");
}

/** Lien vers la même page dans l'autre langue. */
export function otherLanguageHref(path: string, language: "FR" | "DE") {
  return `${path}?langue=${language === "DE" ? "fr" : "de"}`;
}

/** Paramètre de langue à garder dans les liens entre pages de connexion. */
export function languageQuery(language: "FR" | "DE") {
  return language === "DE" ? "?langue=de" : "?langue=fr";
}
