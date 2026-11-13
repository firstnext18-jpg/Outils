import type { NextRequest } from "next/server";
import { fileForTeam } from "@/modules/files/service";
import { fileResponse, readStoredFile } from "@/server/files";
import { getCurrentUser } from "@/server/session";

/** Fichier (fiche client, discussion, justificatif) pour l'équipe ; ?apercu pour l'afficher. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/fichiers/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Introuvable", { status: 404 });
  const file = await fileForTeam(id, user.role);
  const bytes = file && (await readStoredFile(file.storageName));
  if (!file || !bytes) return new Response("Introuvable", { status: 404 });
  return fileResponse(file, bytes, { preview: request.nextUrl.searchParams.has("apercu") });
}
