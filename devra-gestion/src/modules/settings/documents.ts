import type { AppSettings } from "@/modules/settings/service";

/** Textes par défaut des devis selon la langue. */
export function quoteDefaultTexts(settings: AppSettings, language: "FR" | "DE") {
  return language === "DE"
    ? { intro: settings.quoteIntroDe, conditions: settings.quoteConditionsDe }
    : { intro: settings.quoteIntroFr, conditions: settings.quoteConditionsFr };
}

/** Réglages utiles à l'éditeur de devis (transmis au navigateur). */
export function quoteEditorSettings(settings: AppSettings) {
  return {
    quoteValidityDays: settings.quoteValidityDays,
    vatEnabled: settings.vatEnabled,
    vatRates: settings.vatRates,
    defaultVatRate: settings.vatEnabled ? (settings.vatRates[0] ?? null) : null,
    texts: {
      FR: quoteDefaultTexts(settings, "FR"),
      DE: quoteDefaultTexts(settings, "DE"),
    },
  };
}

export type QuoteEditorSettings = ReturnType<typeof quoteEditorSettings>;

/** Coordonnées de l'entreprise figées sur un document envoyé. */
export function companySnapshot(settings: AppSettings) {
  return {
    // Nom réellement saisi (vide s'il manque) : pas de nom générique sur un document.
    name: settings.companyName.trim(),
    street: settings.companyStreet,
    streetNumber: settings.companyStreetNumber,
    postalCode: settings.companyPostalCode,
    city: settings.companyCity,
    country: settings.companyCountry,
    email: settings.companyEmail,
    phone: settings.companyPhone,
    website: settings.companyWebsite,
    vatNumber: settings.vatNumber,
    logoFile: settings.logoFile,
    footerFr: settings.documentFooterFr,
    footerDe: settings.documentFooterDe,
  };
}

export type CompanySnapshot = ReturnType<typeof companySnapshot>;
