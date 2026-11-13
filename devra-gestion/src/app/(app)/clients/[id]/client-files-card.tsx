"use client";

import { EyeIcon, EyeOffIcon, FolderOpenIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { FileList, type FileListItem } from "@/components/files/file-list";
import { FilePicker } from "@/components/files/file-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { uploadProblem } from "@/domain/files";
import {
  deleteFileAction,
  setFileVisibilityAction,
  uploadClientFilesAction,
} from "@/modules/files/actions";

export type ClientFileView = Omit<FileListItem, "href" | "actions" | "badges"> & {
  visibleToClient: boolean;
  uploadedByClient: boolean;
  project: string | null;
  inDiscussion: boolean;
};

/**
 * Fichiers du client (maquettes, contrats, logos…) : envoi, partage dans son
 * espace client, suppression. Les pièces jointes des discussions y figurent aussi.
 */
export function ClientFilesCard({
  clientId,
  projectId = null,
  files,
  canEdit,
  hasPortal,
  title = "Fichiers",
}: {
  clientId: string;
  projectId?: string | null;
  files: ClientFileView[];
  canEdit: boolean;
  hasPortal: boolean;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [share, setShare] = useState(hasPortal);

  function upload(picked: File[]) {
    const problem = uploadProblem(picked);
    if (problem) return toast.error(problem);
    const form = new FormData();
    form.set("clientId", clientId);
    if (projectId) form.set("projectId", projectId);
    form.set("visibleToClient", String(share));
    for (const file of picked) form.append("files", file);
    startTransition(async () => {
      const result = await uploadClientFilesAction(form);
      if (result.ok) {
        toast.success(
          result.data.count > 1 ? `${result.data.count} fichiers ajoutés.` : "Fichier ajouté.",
        );
      } else toast.error(result.error);
    });
  }

  function toggle(id: string, visibleToClient: boolean) {
    startTransition(async () => {
      const result = await setFileVisibilityAction({ id, visibleToClient });
      if (result.ok) {
        toast.success(
          visibleToClient
            ? "Fichier partagé avec le client."
            : "Fichier retiré de l'espace client.",
        );
      } else toast.error(result.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteFileAction({ id });
      if (result.ok) toast.success("Fichier supprimé.");
      else toast.error(result.error);
    });
  }

  return (
    <Card id="fichiers">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {hasPortal
              ? "Les fichiers partagés apparaissent dans l'espace client ; le client peut aussi vous en envoyer."
              : "Maquettes, contrats, logos… (20 Mo au plus par fichier)."}
          </CardDescription>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            {hasPortal && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={share} onCheckedChange={(v) => setShare(v === true)} />
                Partager avec le client
              </label>
            )}
            <FilePicker label="Ajouter des fichiers" onPick={upload} disabled={pending} />
          </div>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {files.length > 0 ? (
          <FileList
            label={title}
            files={files.map((file) => ({
              ...file,
              href: `/api/fichiers/${file.id}`,
              badges: [
                ...(file.visibleToClient && hasPortal ? ["Visible par le client"] : []),
                ...(file.uploadedByClient ? ["Envoyé par le client"] : []),
                ...(file.inDiscussion ? ["Discussion"] : []),
                ...(file.project ? [file.project] : []),
              ],
              actions: canEdit && (
                <div className="flex shrink-0 items-center">
                  {hasPortal && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending}
                      aria-label={
                        file.visibleToClient
                          ? `Retirer ${file.name} de l'espace client`
                          : `Partager ${file.name} avec le client`
                      }
                      onClick={() => toggle(file.id, !file.visibleToClient)}
                    >
                      {file.visibleToClient ? <EyeIcon /> : <EyeOffIcon />}
                    </Button>
                  )}
                  <ConfirmButton
                    size="icon-sm"
                    title={`Supprimer « ${file.name} » ?`}
                    description="Le fichier sera effacé définitivement, y compris de l'espace client."
                    confirmLabel="Supprimer"
                    destructive
                    disabled={pending}
                    onConfirm={() => remove(file.id)}
                  >
                    <Trash2Icon />
                    <span className="sr-only">Supprimer {file.name}</span>
                  </ConfirmButton>
                </div>
              ),
            }))}
          />
        ) : (
          <div className="text-muted-foreground flex items-center gap-3 rounded-md border border-dashed p-4">
            <FolderOpenIcon className="size-5" /> Aucun fichier.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
