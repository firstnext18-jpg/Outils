import { getSettings } from "@/modules/settings/service";
import { detectImageType, readUpload } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Logo de l'entreprise. Public : il apparaît sur la page de connexion et, plus
 * tard, sur la page d'acceptation des devis. Le nom du fichier change à chaque
 * envoi, ce qui permet un cache long côté navigateur.
 */
export async function GET() {
  const { logoFile } = await getSettings();
  const bytes = logoFile ? await readUpload(logoFile) : null;
  const type = bytes ? detectImageType(bytes) : null;
  if (!bytes || !type) return new Response("Aucun logo", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type.mimeType,
      "Cache-Control": "public, max-age=300",
      ETag: `"${logoFile}"`,
    },
  });
}
