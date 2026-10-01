/**
 * Libellés fixes des documents (devis, factures) en français et en allemand.
 * Les textes sont dans fr.json et de.json pour pouvoir être relus facilement ;
 * un test vérifie que les deux fichiers ont exactement les mêmes clés.
 */
import de from "@/i18n/documents/de.json";
import fr from "@/i18n/documents/fr.json";

export type DocumentLabels = typeof fr;
export type DocumentLanguage = "FR" | "DE";

const LABELS: Record<DocumentLanguage, DocumentLabels> = { FR: fr, DE: de };

export function documentLabels(language: DocumentLanguage): DocumentLabels {
  return LABELS[language];
}

/** Remplace les variables {nom} d'un libellé. */
export function fillLabel(label: string, values: Record<string, string | number>): string {
  return label.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
