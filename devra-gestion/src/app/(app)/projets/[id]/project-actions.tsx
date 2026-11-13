"use client";

import { EllipsisIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectStatus } from "@/domain/time";
import { deleteProjectAction, setProjectStatusAction } from "@/modules/projects/actions";

export function ProjectActions({
  project,
}: {
  project: { id: string; name: string; status: ProjectStatus; clientId: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function setStatus(status: ProjectStatus, message: string) {
    startTransition(async () => {
      const result = await setProjectStatusAction({ id: project.id, status });
      if (result.ok) toast.success(message);
      else toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteProjectAction({ id: project.id });
      if (!result.ok) {
        toast.error(result.error);
        setConfirmDelete(false);
        return;
      }
      toast.success("Projet supprimé.");
      router.replace(`/clients/${project.clientId}`);
    });
  }

  return (
    <div className="flex gap-2">
      <Button asChild>
        <Link href={`/projets/${project.id}/modifier`}>
          <PencilIcon /> Modifier
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Autres actions" disabled={pending}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {project.status !== "DONE" && (
            <DropdownMenuItem onSelect={() => setStatus("DONE", "Projet terminé.")}>
              Marquer comme terminé
            </DropdownMenuItem>
          )}
          {project.status === "ACTIVE" && (
            <DropdownMenuItem onSelect={() => setStatus("PAUSED", "Projet mis en pause.")}>
              Mettre en pause
            </DropdownMenuItem>
          )}
          {project.status !== "ACTIVE" && (
            <DropdownMenuItem onSelect={() => setStatus("ACTIVE", "Projet repris.")}>
              Reprendre le projet
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le projet {project.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ses étapes et le temps saisi (non facturé) seront effacés. Ses fichiers restent sur la
              fiche du client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
