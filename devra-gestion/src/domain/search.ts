/**
 * Texte de recherche et de tri : minuscules, sans accents, espaces simples.
 * Stocké en base à chaque enregistrement pour que la recherche ignore les
 * accents (« zurich » trouve « Zürich ») et que le tri range « Émile » avec les E.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots d'une recherche saisie par l'utilisateur (normalisés, 8 au maximum). */
export function searchWords(query: string): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean).slice(0, 8);
}
