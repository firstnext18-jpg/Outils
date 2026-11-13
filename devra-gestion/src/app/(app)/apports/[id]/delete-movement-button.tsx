"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { deletePartnerMovementAction } from "@/modules/partners/actions";

export function DeleteMovementButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmButton
      variant="outline"
      size="default"
      title="Supprimer ce mouvement ?"
      description="Le mouvement et ses justificatifs seront effacés définitivement."
      confirmLabel="Supprimer"
      destructive
      disabled={pending}
      onConfirm={() =>
        startTransition(async () => {
          const result = await deletePartnerMovementAction({ id });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Mouvement supprimé.");
          router.replace("/apports");
        })
      }
    >
      <Trash2Icon /> Supprimer
    </ConfirmButton>
  );
}
