import type { NextRequest } from "next/server";
import { rangeFileSuffix } from "@/domain/accounting";
import { describeRange } from "@/domain/dashboard";
import { hasRole } from "@/domain/roles";
import { EXPORT_DATASETS, exportRangeSchema, type ExportDataset } from "@/modules/exports/service";
import { logActivity } from "@/server/activity";
import { getCurrentUser } from "@/server/session";
import { buildTypedCsv, buildTypedXlsx } from "@/server/spreadsheet";

/**
 * Export comptable d'une période :
 *   ?du=…&au=…&format=xlsx            classeur (factures, paiements, clients)
 *   ?du=…&au=…&format=csv&jeu=factures un fichier CSV par jeu de données
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasRole(user.role, "READONLY"))
    return new Response("Non autorisé", { status: 401 });

  const search = request.nextUrl.searchParams;
  const parsed = exportRangeSchema.safeParse({ du: search.get("du"), au: search.get("au") });
  if (!parsed.success) {
    return new Response(parsed.error.issues[0]?.message ?? "Période invalide", { status: 400 });
  }
  const range = parsed.data;
  const format = search.get("format") === "csv" ? "csv" : "xlsx";
  const dataset = search.get("jeu");
  if (format === "csv" && !(dataset && dataset in EXPORT_DATASETS)) {
    return new Response("Jeu de données inconnu", { status: 400 });
  }

  const headers = { "Cache-Control": "no-store" };
  if (format === "csv") {
    const key = dataset as ExportDataset;
    const sheet = await EXPORT_DATASETS[key].build(range);
    await logActivity({
      userId: user.id,
      action: "export.accounting",
      entityType: "export",
      details: {
        dataset: EXPORT_DATASETS[key].label.toLowerCase(),
        format,
        period: describeRange(range),
      },
    });
    const fileName = `${EXPORT_DATASETS[key].label}_${rangeFileSuffix(range)}.csv`;
    return new Response(buildTypedCsv(sheet), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  const sheets = await Promise.all(
    Object.values(EXPORT_DATASETS).map((entry) => entry.build(range)),
  );
  await logActivity({
    userId: user.id,
    action: "export.accounting",
    entityType: "export",
    details: { dataset: "factures, paiements, clients", format, period: describeRange(range) },
  });
  const xlsx = await buildTypedXlsx(sheets);
  return new Response(new Uint8Array(xlsx), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Comptabilite_${rangeFileSuffix(range)}.xlsx"`,
    },
  });
}
