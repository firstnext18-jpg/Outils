import { z } from "zod";
import { IMPORT_FIELDS, type ImportFieldKey } from "@/domain/client-import";
import { IMPORT_MAX_ROWS } from "@/modules/clients/import-limits";

const fieldKeys = IMPORT_FIELDS.map((f) => f.key) as [ImportFieldKey, ...ImportFieldKey[]];

export const importMappingSchema = z
  .partialRecord(z.enum(fieldKeys), z.number().int().min(0).max(500))
  .refine(
    (mapping) => mapping.lastName !== undefined || mapping.companyName !== undefined,
    "Associez au moins la colonne « Nom » ou « Raison sociale ».",
  );

export const importTableSchema = z.object({
  headers: z.array(z.string().max(200)).min(1).max(500),
  rows: z
    .array(z.array(z.string().max(10_000)).max(500))
    .min(1)
    .max(IMPORT_MAX_ROWS),
});

export const importPreviewSchema = z.object({
  table: importTableSchema,
  mapping: importMappingSchema,
});

export const importCommitSchema = importPreviewSchema.extend({
  fileName: z.string().max(255),
  duplicates: z.enum(["skip", "import"]),
});

export type ImportRowStatus = "ok" | "error" | "duplicate";

export type ImportPreviewRow = {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1). */
  line: number;
  displayName: string;
  email: string;
  city: string;
  status: ImportRowStatus;
  /** Doublon d'un client existant ou d'une ligne précédente du fichier. */
  duplicateOf?: "existing" | "file";
  errors: string[];
  warnings: string[];
};

export type ImportPreview = {
  rows: ImportPreviewRow[];
  counts: Record<ImportRowStatus, number>;
};
