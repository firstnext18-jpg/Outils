import { z } from "zod";

/** Email à un client : objet et message ; `replyToId` pour répondre dans le fil. */
export const mailInputSchema = z.object({
  clientId: z.uuid("Choisissez un client"),
  subject: z.string().trim().min(1, "Indiquez l'objet").max(200, "200 caractères maximum"),
  body: z.string().trim().min(1, "Écrivez le message").max(20_000, "Message trop long"),
  replyToId: z.uuid().nullable(),
});
export type MailInput = z.input<typeof mailInputSchema>;
export type MailData = z.output<typeof mailInputSchema>;
