import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Reporte sur les champs du formulaire les erreurs renvoyées par une action serveur. */
export function applyServerFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string[] | undefined> | undefined,
) {
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    const message = messages?.[0];
    if (message) setError(field as Path<T>, { type: "server", message });
  }
}
