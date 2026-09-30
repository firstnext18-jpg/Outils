import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * Reporte sur les champs du formulaire les erreurs renvoyées par une action
 * serveur. `prefix` retire l'enveloppe éventuelle (ex. « client. »).
 */
export function applyServerFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string[] | undefined> | undefined,
  prefix = "",
) {
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    const message = messages?.[0];
    if (!message) continue;
    const name = prefix && field.startsWith(prefix) ? field.slice(prefix.length) : field;
    setError(name as Path<T>, { type: "server", message });
  }
}
