import { z } from "zod";
import { parseRecipients } from "@/domain/email-template";

/** Envoi d'un devis ou d'une facture par email (valeurs du formulaire d'envoi). */
export const sendEmailSchema = z
  .object({
    /** Relance : `id` est celui de la facture relancée. */
    kind: z.enum(["quote", "invoice", "reminder"]),
    id: z.uuid("Identifiant invalide"),
    /** Facture en brouillon : version lue, pour l'émission. */
    version: z.number().int().nonnegative().optional(),
    to: z.string().max(1000, "Liste trop longue"),
    subject: z.string().trim().min(1, "L'objet est obligatoire").max(200, "200 caractères maximum"),
    body: z
      .string()
      .trim()
      .min(1, "Le message est obligatoire")
      .max(10_000, "10'000 caractères maximum"),
    copyToSender: z.boolean(),
  })
  .superRefine((input, ctx) => {
    const recipients = parseRecipients(input.to);
    if ("error" in recipients)
      ctx.addIssue({ code: "custom", path: ["to"], message: recipients.error });
  })
  .transform(({ to, ...input }) => {
    const recipients = parseRecipients(to);
    return { ...input, to: "emails" in recipients ? recipients.emails : [] };
  });

export type SendEmailInput = z.input<typeof sendEmailSchema>;
export type SendEmailData = z.output<typeof sendEmailSchema>;
