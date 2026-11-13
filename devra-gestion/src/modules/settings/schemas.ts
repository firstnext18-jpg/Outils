import { z } from "zod";
import { unknownVariables } from "@/domain/email-template";
import { isQrIban, isValidSwissIban, normalizeIban } from "@/domain/iban";
import { parseChfInput } from "@/domain/money";
import { validateNumberFormat } from "@/domain/numbering";
import { parsePercent } from "@/domain/percent";
import { isValidQrrPrefix, MAX_QRR_PREFIX_LENGTH } from "@/domain/qr-reference";

// Longueurs maximales alignées sur la QR-facture (normes SIX).
const optionalText = (max: number) => z.string().trim().max(max, `${max} caractères maximum`);

export const companySettingsSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Le nom de l'entreprise est obligatoire")
    .max(70, "70 caractères maximum"),
  companyStreet: optionalText(70),
  companyStreetNumber: optionalText(16),
  companyPostalCode: optionalText(16),
  companyCity: optionalText(35),
  companyCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Code pays à 2 lettres (ex. CH)"),
  companyEmail: z.union([
    z.literal(""),
    z.string().trim().toLowerCase().pipe(z.email("Adresse email invalide")),
  ]),
  companyPhone: optionalText(30),
  companyWebsite: optionalText(100),
  iban: z
    .string()
    .transform(normalizeIban)
    .refine(
      (v) => v === "" || isValidSwissIban(v),
      "IBAN suisse invalide (CH ou LI, 21 caractères)",
    )
    .refine(
      (v) => v === "" || !isQrIban(v),
      "Ceci est un QR-IBAN : saisissez-le dans le champ QR-IBAN",
    ),
  qrIban: z
    .string()
    .transform(normalizeIban)
    .refine(
      (v) => v === "" || isValidSwissIban(v),
      "IBAN suisse invalide (CH ou LI, 21 caractères)",
    )
    .refine((v) => v === "" || isQrIban(v), "Ce n'est pas un QR-IBAN (IID entre 30000 et 31999)"),
  qrReferencePrefix: z
    .string()
    .trim()
    .refine(isValidQrrPrefix, `Chiffres uniquement, ${MAX_QRR_PREFIX_LENGTH} au maximum`),
});

export type CompanySettingsInput = z.input<typeof companySettingsSchema>;
export type CompanySettingsOutput = z.output<typeof companySettingsSchema>;

/** Taille maximale du logo. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Textes des documents
// ---------------------------------------------------------------------------

export const documentTextsSchema = z.object({
  quoteIntroFr: optionalText(5000),
  quoteIntroDe: optionalText(5000),
  quoteConditionsFr: optionalText(5000),
  quoteConditionsDe: optionalText(5000),
  invoiceIntroFr: optionalText(5000),
  invoiceIntroDe: optionalText(5000),
  invoiceConditionsFr: optionalText(5000),
  invoiceConditionsDe: optionalText(5000),
  documentFooterFr: optionalText(300),
  documentFooterDe: optionalText(300),
});
export type DocumentTextsInput = z.input<typeof documentTextsSchema>;

// ---------------------------------------------------------------------------
// Modèles d'emails
// ---------------------------------------------------------------------------

/** Texte d'un modèle : obligatoire, sans variable inconnue (faute de frappe). */
const templateText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} est obligatoire`)
    .max(max, `${max} caractères maximum`)
    .superRefine((value, ctx) => {
      const unknown = unknownVariables(value);
      if (unknown.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `Variable inconnue : ${unknown.map((v) => `{${v}}`).join(", ")}`,
        });
      }
    });

export const emailTemplatesSchema = z.object({
  quoteEmailSubjectFr: templateText(200, "L'objet"),
  quoteEmailSubjectDe: templateText(200, "L'objet"),
  quoteEmailBodyFr: templateText(5000, "Le message"),
  quoteEmailBodyDe: templateText(5000, "Le message"),
  invoiceEmailSubjectFr: templateText(200, "L'objet"),
  invoiceEmailSubjectDe: templateText(200, "L'objet"),
  invoiceEmailBodyFr: templateText(5000, "Le message"),
  invoiceEmailBodyDe: templateText(5000, "Le message"),
});
export type EmailTemplatesInput = z.input<typeof emailTemplatesSchema>;

// ---------------------------------------------------------------------------
// Facturation : numérotation, délais, TVA
// ---------------------------------------------------------------------------

const numberFormatSchema = z
  .string()
  .trim()
  .superRefine((format, ctx) => {
    const error = validateNumberFormat(format);
    if (error) ctx.addIssue({ code: "custom", message: error });
  });

const daysSchema = (min: number, label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, `${label} : nombre de jours entre ${min} et 365`)
    .transform(Number)
    .refine((days) => days >= min && days <= 365, `${label} : nombre de jours entre ${min} et 365`);

/** Prochain numéro souhaité (vide = inchangé). */
const nextNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{0,6}$/, "Nombre entier attendu")
  .transform((value) => (value ? Number(value) : null))
  .refine((value) => value === null || value >= 1, "Le numéro doit être au moins 1");

export const billingSettingsSchema = z
  .object({
    quoteNumberFormat: numberFormatSchema,
    invoiceNumberFormat: numberFormatSchema,
    nextQuoteNumber: nextNumberSchema,
    nextInvoiceNumber: nextNumberSchema,
    quoteValidityDays: daysSchema(1, "Validité"),
    paymentTermDays: daysSchema(0, "Délai de paiement"),
    onlineAcceptance: z.boolean(),
    vatEnabled: z.boolean(),
    vatNumber: z.string().trim().max(40, "40 caractères maximum"),
    vatRates: z.array(z.string()).min(1, "Au moins un taux").max(5, "5 taux maximum"),
  })
  .superRefine((settings, ctx) => {
    if (
      settings.vatEnabled &&
      !/^CHE-\d{3}\.\d{3}\.\d{3}( (TVA|MWST|IVA))?$/.test(settings.vatNumber)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["vatNumber"],
        message: "Numéro TVA attendu au format CHE-123.456.789 TVA",
      });
    }
    settings.vatRates.forEach((rate, index) => {
      const bps = parsePercent(rate);
      if (bps === null || bps === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["vatRates", index],
          message: "Taux invalide (ex. 8.1)",
        });
      }
    });
  })
  .transform((settings) => ({
    ...settings,
    vatRates: [...new Set(settings.vatRates.map((rate) => parsePercent(rate) ?? 0))],
  }));

export type BillingSettingsInput = z.input<typeof billingSettingsSchema>;
export type BillingSettingsOutput = z.output<typeof billingSettingsSchema>;

// ---------------------------------------------------------------------------
// Relances et abonnements
// ---------------------------------------------------------------------------

/** Frais de relance saisis en CHF (vide ou 0 = sans frais), 1'000 CHF au maximum. */
const feeSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const cents = value === "" ? 0 : parseChfInput(value);
    if (cents === null || cents > 100_000) {
      ctx.addIssue({ code: "custom", message: "Montant invalide (0 à 1'000 CHF)" });
    }
  })
  .transform((value) => (value === "" ? 0 : (parseChfInput(value) ?? 0)));

const reminderTemplate = z.object({
  subject: templateText(200, "L'objet"),
  text: templateText(5000, "Le texte"),
});
const reminderLevelTemplates = z.object({ FR: reminderTemplate, DE: reminderTemplate });

export const reminderSettingsSchema = z.object({
  reminderMode: z.enum(["MANUAL", "AUTOMATIC"]),
  reminderDelay1: daysSchema(1, "Délai du 1er rappel"),
  reminderDelay2: daysSchema(1, "Délai du 2e rappel"),
  reminderDelay3: daysSchema(1, "Délai de la mise en demeure"),
  reminderFee1Cents: feeSchema,
  reminderFee2Cents: feeSchema,
  reminderFee3Cents: feeSchema,
  reminderPaymentDays: daysSchema(1, "Délai de paiement"),
  reminderTemplates: z.object({
    level1: reminderLevelTemplates,
    level2: reminderLevelTemplates,
    level3: reminderLevelTemplates,
  }),
  subscriptionAutoSend: z.boolean(),
});
export type ReminderSettingsInput = z.input<typeof reminderSettingsSchema>;
export type ReminderSettingsOutput = z.output<typeof reminderSettingsSchema>;

// ---------------------------------------------------------------------------
// Projets et sites
// ---------------------------------------------------------------------------

export const projectSiteSettingsSchema = z
  .object({
    hourlyRate: z.string().trim().max(20),
    renewalReminderDays: daysSchema(1, "Rappel des renouvellements"),
    monitorAlertEmail: z.boolean(),
  })
  .superRefine((settings, ctx) => {
    if (settings.hourlyRate && parseChfInput(settings.hourlyRate) === null) {
      ctx.addIssue({ code: "custom", path: ["hourlyRate"], message: "Montant invalide" });
    }
  })
  .transform(({ hourlyRate, ...settings }) => ({
    ...settings,
    hourlyRateCents: hourlyRate ? (parseChfInput(hourlyRate) ?? 0) : 0,
  }));
export type ProjectSiteSettingsInput = z.input<typeof projectSiteSettingsSchema>;
