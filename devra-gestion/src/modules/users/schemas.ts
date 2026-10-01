import { z } from "zod";
import { ROLES } from "@/domain/roles";

// Schémas partagés entre les formulaires (navigateur) et les actions serveur.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Adresse email invalide"));

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est obligatoire")
  .max(100, "100 caractères maximum");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `${PASSWORD_MIN_LENGTH} caractères minimum`)
  .max(PASSWORD_MAX_LENGTH, `${PASSWORD_MAX_LENGTH} caractères maximum`);

export const roleSchema = z.enum(ROLES, "Rôle invalide");

const idSchema = z.uuid("Identifiant invalide");

export const inviteUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: roleSchema,
});
export type InviteUserInput = z.input<typeof inviteUserSchema>;

export const changeRoleSchema = z.object({ userId: idSchema, role: roleSchema });
export const setActiveSchema = z.object({ userId: idSchema, active: z.boolean() });
export const invitationIdSchema = z.object({ invitationId: idSchema });

/** Nouveau mot de passe avec confirmation (invitation et réinitialisation). */
export const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["passwordConfirm"],
  });

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(20, "Lien d'invitation invalide"),
    name: nameSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["passwordConfirm"],
  });
export type AcceptInvitationInput = z.input<typeof acceptInvitationSchema>;
