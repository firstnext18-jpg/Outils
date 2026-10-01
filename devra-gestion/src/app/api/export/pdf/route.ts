import type { NextRequest } from "next/server";
import { rangeFileSuffix } from "@/domain/accounting";
import { describeRange } from "@/domain/dashboard";
import { hasRole } from "@/domain/roles";
import { exportRangeSchema, MAX_PDFS_PER_ARCHIVE, pdfArchive } from "@/modules/exports/service";
import { logActivity } from "@/server/activity";
import { getCurrentUser } from "@/server/session";

/** Archive ZIP des PDF (factures et relances) d'une période : `?du=…&au=…`. */
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
  const archive = await pdfArchive(range);
  if (!archive.ok) {
    return new Response(
      `La période contient ${archive.count} documents (${MAX_PDFS_PER_ARCHIVE} au plus) : choisissez une période plus courte.`,
      { status: 413, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  await logActivity({
    userId: user.id,
    action: "export.pdfs",
    entityType: "export",
    details: { count: archive.count, period: describeRange(range) },
  });
  return new Response(new Uint8Array(archive.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Documents_${rangeFileSuffix(range)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
