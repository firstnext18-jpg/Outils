import { z } from "zod";
import { MESSAGE_MAX } from "@/domain/discussions";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/modules/users/schemas";

/**
 * Formulaires de l'espace client. Les messages d'erreur affichés au client
 * sont traduits dans les actions (i18n/portal.ts) d'après le champ en cause :
 * les textes ci-dessous ne servent qu'aux journaux et aux tests.
 */

export const portalLanguageSchema = z.enum(["FR", "DE"]).catch("FR");

export const portalLoginSchema = z.object({
  login: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  language: portalLanguageSchema,
});

export const portalForgotSchema = z.object({
  loginOrEmail: z.string().trim().min(1).max(200),
  language: portalLanguageSchema,
});

const newPassword = {
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  passwordConfirm: z.string(),
};

function samePasswords(data: { password: string; passwordConfirm: string }) {
  return data.password === data.passwordConfirm;
}

export const portalResetSchema = z
  .object({ token: z.string().max(100), language: portalLanguageSchema, ...newPassword })
  .refine(samePasswords, { path: ["passwordConfirm"] });

export const portalChangePasswordSchema = z
  .object({ current: z.string().min(1).max(PASSWORD_MAX_LENGTH), ...newPassword })
  .refine(samePasswords, { path: ["passwordConfirm"] });

export const portalMessageSchema = z.object({
  body: z.string().trim().min(1).max(MESSAGE_MAX),
});
