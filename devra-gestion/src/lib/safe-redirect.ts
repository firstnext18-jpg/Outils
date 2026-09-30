/**
 * Adresse de retour après connexion (paramètre « suite »). Seuls les chemins
 * internes sont acceptés, pour éviter toute redirection vers un autre site.
 */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
