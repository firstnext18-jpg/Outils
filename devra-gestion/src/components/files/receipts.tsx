"use client";

import { Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { FileList } from "@/components/files/file-list";
import { FilePicker } from "@/components/files/file-picker";
import { uploadProblem } from "@/domain/files";
import { deleteFileAction } from "@/modules/files/actions";
import type { ActionResult } from "@/server/action";

/**
 * Justificatifs (facture du fournisseur, relevé, contrat de prêt…) d'une
 * dépense ou d'un apport d'associé. `addAction` : action serveur qui reçoit
 * « id » et « files ».
 */
export function Receipts({
  ownerId,
  addAction,
  receipts,
  canEdit,
}: {
  ownerId: string;
  addAction: (formData: FormData) => Promise<ActionResult>;
  receipts: { id: string; name: string; size: number; meta: string }[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      {canEdit && (
        <FilePicker
          label="Ajouter un justificatif"
          disabled={pending}
          onPick={(files) => {
            const problem = uploadProblem(files);
            if (problem) return toast.error(problem);
            const form = new FormData();
            form.set("id", ownerId);
            for (const file of files) form.append("files", file);
            startTransition(async () => {
              const result = await addAction(form);
              if (result.ok) toast.success("Justificatif ajouté.");
              else toast.error(result.error);
            });
          }}
        />
      )}
      {receipts.length > 0 ? (
        <FileList
          label="Justificatifs"
          files={receipts.map((r) => ({
            ...r,
            href: `/api/fichiers/${r.id}`,
            actions: canEdit && (
              <ConfirmButton
                size="icon-sm"
                title={`Supprimer « ${r.name} » ?`}
                description="Le justificatif sera effacé définitivement."
                confirmLabel="Supprimer"
                destructive
                disabled={pending}
                onConfirm={() =>
                  startTransition(async () => {
                    const result = await deleteFileAction({ id: r.id });
                    if (result.ok) toast.success("Justificatif supprimé.");
                    else toast.error(result.error);
                  })
                }
              >
                <Trash2Icon />
                <span className="sr-only">Supprimer {r.name}</span>
              </ConfirmButton>
            ),
          }))}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Aucun justificatif.</p>
      )}
    </div>
  );
}
