import { z } from "zod";
import { isQrIban, isValidSwissIban, normalizeIban } from "@/domain/iban";

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
});

export type CompanySettingsInput = z.input<typeof companySettingsSchema>;
export type CompanySettingsOutput = z.output<typeof companySettingsSchema>;

/** Taille maximale du logo. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
