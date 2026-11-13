"use server";

import { revalidatePath } from "next/cache";
import { sendEmailSchema } from "@/modules/emails/schemas";
import { sendInvoiceEmail, sendQuoteEmail, sendQuoteReminder } from "@/modules/emails/service";
import { sendReminderEmail } from "@/modules/reminders/service";
import { authAction } from "@/server/action";
import { z } from "zod";

/** Envoi d'un devis ou d'une facture par email, avec le PDF en pièce jointe. */
export const sendDocumentEmailAction = authAction(
  { role: "MEMBER", schema: sendEmailSchema },
  async (data, { user }) => {
    try {
      if (data.kind === "quote") {
        const result = await sendQuoteEmail(user, data);
        return { number: result.number };
      }
      if (data.kind === "reminder") {
        const result = await sendReminderEmail(user, data);
        return { number: result.number };
      }
      const result = await sendInvoiceEmail(user, data);
      return { number: result.number };
    } finally {
      // Même en cas d'échec : l'historique des envois (et une émission éventuelle) a changé.
      const base = data.kind === "quote" ? "/devis" : "/factures";
      revalidatePath(base);
      revalidatePath(`${base}/${data.id}`);
      if (data.kind === "reminder") revalidatePath("/factures/relances");
      revalidatePath("/clients/[id]", "page");
    }
  },
);

/** Relance du client pour un devis envoyé (bouton de la page du devis). */
export const sendQuoteReminderAction = authAction(
  { role: "MEMBER", schema: z.object({ id: z.uuid() }) },
  async ({ id }, { user }) => {
    const result = await sendQuoteReminder(user, id);
    revalidatePath(`/devis/${id}`);
    return result;
  },
);
