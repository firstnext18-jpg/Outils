/**
 * Fichiers partagés (fiche client, espace client, discussions, justificatifs
 * de dépenses). Module pur : utilisable côté serveur comme côté client.
 */

/** Taille maximale d'un fichier, et nombre de fichiers par envoi. */
export const FILE_MAX_BYTES = 20 * 1024 * 1024;
export const FILES_PER_UPLOAD = 5;

/** « 1.2 Mo », « 830 Ko » (unités décimales, comme l'Explorateur Windows en affiche à peu près). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Nom de fichier affiché et proposé au téléchargement : sans chemin, sans
 * caractères de contrôle ni caractères interdits sous Windows, 150 caractères au plus.
 */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!cleaned) return "fichier";
  if (cleaned.length <= 150) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 150 - extension.length) + extension;
}

/** Erreur de taille ou de nombre, ou `null` si l'envoi est accepté. */
export function uploadProblem(files: { name: string; size: number }[]): string | null {
  if (files.length === 0) return "Choisissez au moins un fichier.";
  if (files.length > FILES_PER_UPLOAD) return `${FILES_PER_UPLOAD} fichiers au plus à la fois.`;
  const tooBig = files.find((f) => f.size > FILE_MAX_BYTES);
  if (tooBig) return `« ${cleanFileName(tooBig.name)} » dépasse ${formatFileSize(FILE_MAX_BYTES)}.`;
  const empty = files.find((f) => f.size === 0);
  if (empty) return `« ${cleanFileName(empty.name)} » est vide.`;
  return null;
}

export type FileKind = "image" | "pdf" | "archive" | "document" | "other";

/** Famille du fichier (icône), d'après son extension. */
export function fileKind(name: string): FileKind {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "avif"].includes(extension))
    return "image";
  if (extension === "pdf") return "pdf";
  if (["zip", "rar", "7z", "gz", "tar"].includes(extension)) return "archive";
  if (
    [
      "doc",
      "docx",
      "odt",
      "txt",
      "rtf",
      "xls",
      "xlsx",
      "ods",
      "csv",
      "ppt",
      "pptx",
      "key",
    ].includes(extension)
  )
    return "document";
  return "other";
}
