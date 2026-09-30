import { z } from "zod";

export const siteTypeNameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est obligatoire")
  .max(50, "50 caractères maximum");

const id = z.uuid("Identifiant invalide");

export const createSiteTypeSchema = z.object({ name: siteTypeNameSchema });
export const renameSiteTypeSchema = z.object({ id, name: siteTypeNameSchema });
export const setSiteTypeActiveSchema = z.object({ id, active: z.boolean() });
export const moveSiteTypeSchema = z.object({ id, direction: z.enum(["up", "down"]) });
export const siteTypeIdSchema = z.object({ id });
