/**
 * Partie de nom de fichier lisible et sans caractères spéciaux :
 * « Boulangerie des Alpes Sàrl » → « BoulangerieDesAlpesSarl ».
 */
export function fileNamePart(value: string, maxLength = 40): string {
  const words = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const joined = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  return joined.slice(0, maxLength) || "Document";
}

/**
 * « Devra_Devis_D-2026-001_BoulangerieDesAlpesSarl.pdf » ; sans le premier
 * élément tant que le nom de l'entreprise n'est pas renseigné.
 */
export function documentFileName(
  company: string,
  documentType: string,
  number: string,
  client: string,
): string {
  const safeNumber = number.replace(/[^A-Za-z0-9\-_.]/g, "-");
  const parts = [documentType, safeNumber, fileNamePart(client)];
  if (company.trim()) parts.unshift(fileNamePart(company));
  return `${parts.join("_")}.pdf`;
}
