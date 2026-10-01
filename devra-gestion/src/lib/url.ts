export type QueryValues = Record<string, string | number | undefined | null>;

/**
 * Construit « /chemin?a=1&b=2 » en ignorant les valeurs vides. Les `overrides`
 * remplacent (ou suppriment, avec `undefined`) les paramètres actuels.
 */
export function withQuery(
  pathname: string,
  current: QueryValues,
  overrides: QueryValues = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...overrides })) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
