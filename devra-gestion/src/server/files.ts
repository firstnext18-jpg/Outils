import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { cleanFileName } from "@/domain/files";
import { env } from "@/server/env";

/**
 * Fichiers envoyés par l'équipe ou les clients, dans DATA_DIR/files sous un
 * nom aléatoire (le nom d'origine n'est qu'en base). DATA_DIR est inclus dans
 * les sauvegardes.
 */
function filesDir(): string {
  return path.resolve(env().DATA_DIR, "files");
}

function storagePath(storageName: string): string {
  if (!/^[0-9a-f-]{36}$/.test(storageName)) throw new Error(`Fichier invalide : ${storageName}`);
  return path.join(filesDir(), storageName);
}

export type SavedFile = { name: string; mimeType: string; size: number; storageName: string };

/** Enregistre le fichier sur le disque ; la ligne en base est créée par l'appelant. */
export async function saveFile(file: File): Promise<SavedFile> {
  await mkdir(filesDir(), { recursive: true });
  const storageName = randomUUID();
  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(storagePath(storageName), bytes);
  return {
    name: cleanFileName(file.name),
    mimeType: (file.type || "application/octet-stream").slice(0, 100),
    size: bytes.byteLength,
    storageName,
  };
}

export async function readStoredFile(storageName: string): Promise<Buffer | null> {
  try {
    return await readFile(storagePath(storageName));
  } catch {
    return null;
  }
}

/** Supprime les fichiers du disque (après suppression des lignes en base). */
export async function deleteStoredFiles(storageNames: string[]) {
  await Promise.all(
    storageNames.map((name) =>
      rm(storagePath(name), { force: true }).catch((error: unknown) =>
        console.error(`Suppression du fichier ${name} impossible`, error),
      ),
    ),
  );
}

/**
 * Type servi au navigateur : affiché dans l'onglet seulement pour les images
 * et les PDF reconnus à leurs premiers octets ; tout le reste est téléchargé
 * (jamais exécuté dans la page : pas de HTML ni de SVG interprétés).
 */
export function servedType(bytes: Uint8Array): { contentType: string; inline: boolean } {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return { contentType: "image/png", inline: true };
  if (starts(0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", inline: true };
  if (starts(0x47, 0x49, 0x46, 0x38)) return { contentType: "image/gif", inline: true };
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45)
    return { contentType: "image/webp", inline: true };
  if (starts(0x25, 0x50, 0x44, 0x46)) return { contentType: "application/pdf", inline: true };
  return { contentType: "application/octet-stream", inline: false };
}

/** Réponse HTTP d'un fichier : téléchargement, ou affichage (?apercu) des images et PDF. */
export function fileResponse(
  file: { name: string },
  bytes: Buffer,
  options: { preview: boolean },
): Response {
  const { contentType, inline } = servedType(bytes);
  const disposition = options.preview && inline ? "inline" : "attachment";
  const ascii = file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Le lecteur PDF de Chrome ne s'ouvre pas dans un document « sandbox ».
      ...(contentType === "application/pdf"
        ? {}
        : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox" }),
    },
  });
}
