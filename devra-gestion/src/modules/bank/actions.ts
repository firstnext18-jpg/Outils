"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { authAction } from "@/server/action";
import * as service from "@/modules/bank/service";

/** Fichiers camt de quelques mégaoctets au plus. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const previewSchema = z.object({
  file: z
    .instanceof(File, { message: "Choisissez le fichier du relevé" })
    .refine(
      (f) => f.size > 0 && f.size <= MAX_FILE_BYTES,
      "Fichier vide ou trop volumineux (10 Mo au plus)",
    ),
});

const preview = authAction({ role: "MEMBER", schema: previewSchema }, async ({ file }) => {
  return service.previewBankFile(await file.text());
});

/** Lecture du relevé : propositions, rien n'est enregistré. */
export async function previewBankFileAction(formData: FormData) {
  const file = formData.get("file");
  return preview({ file: file instanceof File ? file : new File([], "") });
}

const rowSchema = z.object({
  key: z.string().min(10).max(100),
  bookingDate: z.string().refine(isValidIsoDate, "Date invalide"),
  amountCents: z.number().int().positive(),
  reference: z.string().max(40),
  remittance: z.string().max(500),
  debtorName: z.string().max(200),
  invoiceId: z.uuid(),
});

export const importBankPaymentsAction = authAction(
  {
    role: "MEMBER",
    schema: z.object({
      fileName: z.string().max(200),
      rows: z.array(rowSchema).min(1, "Cochez au moins un paiement à enregistrer.").max(1000),
    }),
  },
  async ({ fileName, rows }, { user }) => {
    const result = await service.importBankPayments(user, fileName, rows);
    revalidatePath("/factures");
    revalidatePath("/");
    return result;
  },
);
