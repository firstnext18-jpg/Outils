import "server-only";
import { IMPORT_FIELDS, mapImportRow, type ImportMapping } from "@/domain/client-import";
import { clientDisplayName } from "@/domain/clients";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";
import type { SheetTable } from "@/server/spreadsheet";
import type { ImportPreview, ImportPreviewRow } from "@/modules/clients/import-schemas";
import { clientInputSchema, type ClientData } from "@/modules/clients/schemas";
import { withComputedColumns } from "@/modules/clients/computed-columns";

const FIELD_LABELS: Record<string, string> = {
  ...Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f.label])),
  siteTypeId: "Type de site",
};

type AnalyzedRow = ImportPreviewRow & { data?: ClientData };

/**
 * Analyse chaque ligne : conversion, validation (mêmes règles que le
 * formulaire) et détection des doublons par email, dans la base comme dans
 * le fichier lui-même.
 */
async function analyze(table: SheetTable, mapping: ImportMapping): Promise<AnalyzedRow[]> {
  const siteTypes = await db.siteType.findMany({ select: { id: true, name: true } });
  const mapped = table.rows.map((cells) => mapImportRow(cells, mapping, siteTypes));

  const emails = [...new Set(mapped.map((m) => m.input.email).filter(Boolean))];
  const existing = new Set(
    (await db.client.findMany({ where: { email: { in: emails } }, select: { email: true } })).map(
      (c) => c.email,
    ),
  );
  const seenInFile = new Set<string>();

  return mapped.map(({ input, warnings }, index) => {
    const row: AnalyzedRow = {
      line: index + 2,
      displayName: clientDisplayName(input),
      email: input.email,
      city: input.city,
      status: "ok",
      errors: [],
      warnings,
    };
    const parsed = clientInputSchema.safeParse(input);
    if (!parsed.success) {
      row.status = "error";
      row.errors = parsed.error.issues.map((issue) => {
        const field = FIELD_LABELS[String(issue.path[0])];
        return field ? `${field} : ${issue.message}` : issue.message;
      });
      return row;
    }
    row.data = parsed.data;
    if (input.email) {
      if (existing.has(input.email)) {
        row.status = "duplicate";
        row.duplicateOf = "existing";
      } else if (seenInFile.has(input.email)) {
        row.status = "duplicate";
        row.duplicateOf = "file";
      }
      seenInFile.add(input.email);
    }
    return row;
  });
}

export async function previewImport(
  table: SheetTable,
  mapping: ImportMapping,
): Promise<ImportPreview> {
  const rows = (await analyze(table, mapping)).map(({ data: _data, ...row }) => row);
  const counts = { ok: 0, error: 0, duplicate: 0 };
  for (const row of rows) counts[row.status] += 1;
  return { rows, counts };
}

/**
 * Enregistre les lignes valides en une seule transaction : tout ou rien.
 * Les lignes en erreur sont toujours ignorées ; les doublons selon le choix.
 */
export async function commitImport(
  actor: CurrentUser,
  input: {
    table: SheetTable;
    mapping: ImportMapping;
    fileName: string;
    duplicates: "skip" | "import";
  },
) {
  const analyzed = await analyze(input.table, input.mapping);
  const toCreate = analyzed.filter(
    (row) =>
      row.data &&
      (row.status === "ok" || (row.status === "duplicate" && input.duplicates === "import")),
  );
  if (toCreate.length === 0) throw new UserError("Aucune ligne à importer.");

  await db.$transaction(async (tx) => {
    await tx.client.createMany({
      data: toCreate.map((row) => ({
        ...withComputedColumns(row.data!),
        createdById: actor.id,
        updatedById: actor.id,
      })),
    });
    await logActivity(
      {
        userId: actor.id,
        action: "clients.imported",
        entityType: "client",
        label: input.fileName,
        details: { created: toCreate.length, rows: analyzed.length },
      },
      tx,
    );
  });

  return {
    created: toCreate.length,
    skippedErrors: analyzed.filter((r) => r.status === "error").length,
    skippedDuplicates:
      input.duplicates === "skip" ? analyzed.filter((r) => r.status === "duplicate").length : 0,
  };
}
