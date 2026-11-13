"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteExpenseAction } from "@/modules/expenses/actions";

export function DeleteExpenseButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmButton
      variant="outline"
      size="default"
      title="Supprimer cette dépense ?"
      description="La dépense et ses justificatifs seront effacés définitivement."
      confirmLabel="Supprimer"
      destructive
      disabled={pending}
      onConfirm={() =>
        startTransition(async () => {
          const result = await deleteExpenseAction({ id });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Dépense supprimée.");
          router.replace("/depenses");
        })
      }
    >
      <Trash2Icon /> Supprimer
    </ConfirmButton>
  );
}
