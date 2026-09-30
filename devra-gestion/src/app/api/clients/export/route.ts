import type { NextRequest } from "next/server";
import { hasRole } from "@/domain/roles";
import { CLIENT_EXPORT_HEADERS, clientExportRow } from "@/modules/clients/export";
import { clientListParamsSchema } from "@/modules/clients/schemas";
import { listClientsForExport } from "@/modules/clients/service";
import { logActivity } from "@/server/activity";
import { getCurrentUser } from "@/server/session";
import { buildCsv, buildXlsx } from "@/server/spreadsheet";

/** Export de la liste des clients (mêmes filtres que la page), en CSV ou Excel. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasRole(user.role, "READONLY"))
    return new Response("Non autorisé", { status: 401 });

  const search = request.nextUrl.searchParams;
  const format = search.get("format") === "csv" ? "csv" : "xlsx";
  const params = clientListParamsSchema.parse(Object.fromEntries(search));
  const clients = await listClientsForExport(params);
  const rows = clients.map(clientExportRow);

  await logActivity({
    userId: user.id,
    action: "clients.exported",
    entityType: "client",
    details: { format, count: clients.length },
  });

  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" }); // AAAA-MM-JJ
  const fileName = `Clients_${date}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store",
  };

  if (format === "csv") {
    return new Response(buildCsv(CLIENT_EXPORT_HEADERS, rows), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  const xlsx = await buildXlsx("Clients", CLIENT_EXPORT_HEADERS, rows);
  return new Response(new Uint8Array(xlsx), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
