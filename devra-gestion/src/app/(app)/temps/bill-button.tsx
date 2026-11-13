"use client";

import { ReceiptTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { billTimeAction } from "@/modules/time/actions";

/** Crée le brouillon de facture du temps non facturé du client, puis l'ouvre. */
export function BillTimeButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      aria-label={`Facturer le temps de ${clientName}`}
      onClick={() =>
        startTransition(async () => {
          const result = await billTimeAction({ clientId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Brouillon de facture créé.");
          router.push(`/factures/${result.data.invoiceId}`);
        })
      }
    >
      <ReceiptTextIcon /> {pending ? "Création…" : "Créer la facture"}
    </Button>
  );
}
