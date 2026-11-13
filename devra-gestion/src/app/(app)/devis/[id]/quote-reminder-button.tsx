"use client";

import { BellRingIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { sendQuoteReminderAction } from "@/modules/emails/actions";

/** Relance du client par email pour un devis envoyé sans réponse. */
export function QuoteReminderButton({
  quoteId,
  email,
  lastReminder,
}: {
  quoteId: string;
  email: string;
  lastReminder: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-1">
      <ConfirmButton
        variant="outline"
        size="sm"
        title="Relancer le client ?"
        description={`Un email de relance (modèle des paramètres, PDF joint) part à ${email}.${lastReminder ? ` Dernière relance : ${lastReminder}.` : ""}`}
        confirmLabel="Envoyer la relance"
        disabled={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await sendQuoteReminderAction({ id: quoteId });
            if (result.ok) toast.success(`Relance envoyée à ${result.data.to}.`);
            else toast.error(result.error);
          })
        }
      >
        <BellRingIcon /> Relancer le client
      </ConfirmButton>
      {lastReminder && <p className="text-muted-foreground text-xs">Relancé le {lastReminder}</p>}
    </div>
  );
}
