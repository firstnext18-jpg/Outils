import { DEFAULT_REMINDER_TEMPLATES, type ReminderTemplates } from "@/domain/reminder-templates";
import type { ReminderRules } from "@/domain/reminders";
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

/** Textes par défaut des factures selon la langue. */
export function invoiceDefaultTexts(settings: AppSettings, language: "FR" | "DE") {
  return language === "DE"
    ? { intro: settings.invoiceIntroDe, conditions: settings.invoiceConditionsDe }
    : { intro: settings.invoiceIntroFr, conditions: settings.invoiceConditionsFr };
}

/** Réglages utiles à l'éditeur de factures (transmis au navigateur). */
export function invoiceEditorSettings(settings: AppSettings) {
  return {
    paymentTermDays: settings.paymentTermDays,
    vatEnabled: settings.vatEnabled,
    vatRates: settings.vatRates,
    defaultVatRate: settings.vatEnabled ? (settings.vatRates[0] ?? null) : null,
    texts: {
      FR: invoiceDefaultTexts(settings, "FR"),
      DE: invoiceDefaultTexts(settings, "DE"),
    },
  };
}

export type InvoiceEditorSettings = ReturnType<typeof invoiceEditorSettings>;

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

/** Coordonnées du client figées sur le document. */
export function clientSnapshot(client: {
  displayName: string;
  kind: string;
  contactName: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  country: string;
}) {
  return {
    displayName: client.displayName,
    kind: client.kind,
    contactName: client.contactName,
    street: client.street,
    streetNumber: client.streetNumber,
    postalCode: client.postalCode,
    city: client.city,
    country: client.country,
  };
}

export type ClientSnapshot = ReturnType<typeof clientSnapshot>;

/** Règles de relance (délais, frais, nouveau délai de paiement) tirées des paramètres. */
export function reminderRules(settings: AppSettings): ReminderRules {
  return {
    delays: { 1: settings.reminderDelay1, 2: settings.reminderDelay2, 3: settings.reminderDelay3 },
    feesCents: {
      1: settings.reminderFee1Cents,
      2: settings.reminderFee2Cents,
      3: settings.reminderFee3Cents,
    },
    paymentDays: settings.reminderPaymentDays,
  };
}

/** Textes des relances : ceux des paramètres, sinon les textes par défaut. */
export function reminderTemplates(settings: AppSettings): ReminderTemplates {
  const saved = settings.reminderTemplates as Partial<ReminderTemplates> | null;
  return { ...DEFAULT_REMINDER_TEMPLATES, ...(saved ?? {}) };
}
