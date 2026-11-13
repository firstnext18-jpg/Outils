import type { NextRequest } from "next/server";
import { fileForPortal } from "@/modules/files/service";
import { fileResponse, readStoredFile } from "@/server/files";
import { getPortalSession } from "@/server/portal-session";

/** Fichier partagé avec le client connecté (jamais un fichier interne ni celui d'un autre client). */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/espace-client/fichiers/[id]">,
) {
  const session = await getPortalSession();
  if (!session) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const file = await fileForPortal(session.client.id, id);
  const bytes = file && (await readStoredFile(file.storageName));
  if (!file || !bytes) return new Response("Introuvable", { status: 404 });
  return fileResponse(file, bytes, { preview: request.nextUrl.searchParams.has("apercu") });
}
