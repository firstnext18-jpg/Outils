import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";

/**
 * Fichiers de l'application (logo, puis PDF archivés) dans DATA_DIR.
 * En production, DATA_DIR est un volume Docker inclus dans les sauvegardes.
 */
function uploadsDir(): string {
  return path.resolve(env().DATA_DIR, "uploads");
}

/** Chemin sûr d'un fichier : refuse tout nom qui sortirait du dossier. */
function safePath(fileName: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) throw new Error(`Nom de fichier invalide : ${fileName}`);
  return path.join(uploadsDir(), fileName);
}

export type ImageType = { extension: "png" | "jpg"; mimeType: "image/png" | "image/jpeg" };

/**
 * Détecte le type réel d'une image à partir de ses premiers octets (on ne fait
 * pas confiance à l'extension ni au type annoncé par le navigateur).
 * PNG et JPEG seulement : ce sont les formats que PDFKit sait intégrer.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => bytes[i] === byte)) return { extension: "png", mimeType: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  return null;
}

export async function saveUpload(prefix: string, extension: string, bytes: Uint8Array) {
  await mkdir(uploadsDir(), { recursive: true });
  const fileName = `${prefix}-${randomUUID()}.${extension}`;
  await writeFile(safePath(fileName), bytes);
  return fileName;
}

export async function readUpload(fileName: string): Promise<Buffer | null> {
  try {
    return await readFile(safePath(fileName));
  } catch {
    return null;
  }
}

export async function deleteUpload(fileName: string) {
  await rm(safePath(fileName), { force: true });
}

/**
 * PDF archivés des documents émis (DATA_DIR/documents/<type>/<id>.pdf) : le
 * fichier envoyé au client est conservé tel quel, même si la mise en page ou
 * les paramètres changent ensuite.
 */
function documentPath(kind: "invoices", id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`Identifiant invalide : ${id}`);
  return path.resolve(env().DATA_DIR, "documents", kind, `${id}.pdf`);
}

export async function saveDocumentPdf(kind: "invoices", id: string, bytes: Uint8Array) {
  const file = documentPath(kind, id);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return path.relative(path.resolve(env().DATA_DIR, "documents"), file);
}

export async function readDocumentPdf(kind: "invoices", id: string): Promise<Buffer | null> {
  try {
    return await readFile(documentPath(kind, id));
  } catch {
    return null;
  }
}
