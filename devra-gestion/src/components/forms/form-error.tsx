import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Message d'erreur global d'un formulaire (renvoyé par le serveur). */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
