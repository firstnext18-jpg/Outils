import { z } from "zod";
import { DISCUSSION_TITLE_MAX, GENERAL_DISCUSSION_ID, MESSAGE_MAX } from "@/domain/discussions";

const discussionIdSchema = z.union(
  [z.literal(GENERAL_DISCUSSION_ID), z.uuid()],
  "Discussion introuvable",
);

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, "Écrivez un message")
  .max(MESSAGE_MAX, `${MESSAGE_MAX} caractères au plus`);

export const createDiscussionSchema = z.object({
  clientId: z.uuid("Choisissez un client"),
  title: z
    .string()
    .trim()
    .min(1, "Indiquez le sujet de la discussion")
    .max(DISCUSSION_TITLE_MAX, `${DISCUSSION_TITLE_MAX} caractères au plus`),
  body: messageBodySchema,
});
export type CreateDiscussionInput = z.input<typeof createDiscussionSchema>;

export const postMessageSchema = z.object({
  discussionId: discussionIdSchema,
  body: messageBodySchema,
});

/** Message avec pièces jointes : le texte peut alors être vide. */
export const postMessageWithFilesSchema = z.object({
  discussionId: discussionIdSchema,
  body: z.string().trim().max(MESSAGE_MAX, `${MESSAGE_MAX} caractères au plus`),
  files: z.array(z.instanceof(File)).min(1, "Choisissez au moins un fichier."),
});

export const markReadSchema = z.object({ discussionId: discussionIdSchema });

/** Abonnement Web Push envoyé par le navigateur (PushSubscription.toJSON()). */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://", "Adresse de notification invalide").max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
  device: z.string().trim().max(100).default(""),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionSchema>;

export const pushEndpointSchema = z.object({ endpoint: z.string().max(1000) });
