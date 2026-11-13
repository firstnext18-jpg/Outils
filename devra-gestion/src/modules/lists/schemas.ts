import { z } from "zod";
import { LIST_ITEM_MAX, LIST_KINDS } from "@/domain/lists";

export const listKindSchema = z.enum(LIST_KINDS, "Liste inconnue");

export const listItemNameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est obligatoire")
  .max(LIST_ITEM_MAX, `${LIST_ITEM_MAX} caractères maximum`);

const id = z.uuid("Identifiant invalide");

export const createListItemSchema = z.object({ kind: listKindSchema, name: listItemNameSchema });
export const renameListItemSchema = z.object({ id, name: listItemNameSchema });
export const setListItemActiveSchema = z.object({ id, active: z.boolean() });
export const moveListItemSchema = z.object({ id, direction: z.enum(["up", "down"]) });
export const listItemIdSchema = z.object({ id });
