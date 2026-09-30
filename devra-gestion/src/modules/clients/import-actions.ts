"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authAction, UserError } from "@/server/action";
import { parseSpreadsheetFile, SpreadsheetError } from "@/server/spreadsheet";
import { commitImport, previewImport } from "@/modules/clients/import";
import { importCommitSchema, importPreviewSchema } from "@/modules/clients/import-schemas";

/** Étape 1 : lecture du fichier envoyé (CSV ou Excel). */
export const parseImportFileAction = authAction(
  { role: "MEMBER", schema: z.instanceof(FormData) },
  async (formData) => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new UserError("Choisissez un fichier.");
    try {
      const table = await parseSpreadsheetFile(file);
      return { fileName: file.name, ...table };
    } catch (error) {
      if (error instanceof SpreadsheetError) throw new UserError(error.message);
      throw error;
    }
  },
);

/** Étape 3 : vérification des lignes (erreurs, doublons) avant l'import. */
export const previewImportAction = authAction(
  { role: "MEMBER", schema: importPreviewSchema },
  async ({ table, mapping }) => previewImport(table, mapping),
);

/** Étape 4 : import définitif. */
export const commitImportAction = authAction(
  { role: "MEMBER", schema: importCommitSchema },
  async (input, { user }) => {
    const result = await commitImport(user, input);
    revalidatePath("/clients");
    return result;
  },
);
