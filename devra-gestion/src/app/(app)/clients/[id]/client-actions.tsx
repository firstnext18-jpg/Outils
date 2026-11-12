"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  DownloadIcon,
  EllipsisIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
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
import { deleteClientAction, setClientArchivedAction } from "@/modules/clients/actions";

type Dialog = "archive" | "delete" | null;

export function ClientActions({
  client,
}: {
  client: { id: string; displayName: string; archived: boolean };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);

  function toggleArchive() {
    startTransition(async () => {
      const result = await setClientArchivedAction({ id: client.id, archived: !client.archived });
      if (result.ok) toast.success(client.archived ? "Client désarchivé." : "Client archivé.");
      else toast.error(result.error);
      setDialog(null);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteClientAction({ id: client.id });
      if (!result.ok) {
        toast.error(result.error);
        setDialog(null);
        return;
      }
      toast.success(`${client.displayName} a été supprimé.`);
      router.replace("/clients");
    });
  }

  return (
    <>
      <Button asChild>
        <Link href={`/clients/${client.id}/modifier`}>
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
          <DropdownMenuItem
            onSelect={() => (client.archived ? toggleArchive() : setDialog("archive"))}
          >
            {client.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
            {client.archived ? "Désarchiver" : "Archiver"}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/api/clients/${client.id}/donnees`} download>
              <DownloadIcon /> Exporter ses données (nLPD)
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2Icon /> Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={dialog === "archive"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver {client.displayName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le client n&apos;apparaîtra plus dans la liste (sauf avec le filtre « Archivés »). Sa
              fiche et son historique sont conservés, et vous pourrez le désarchiver à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={toggleArchive} disabled={pending}>
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement {client.displayName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              La fiche, ses discussions et son accès à l&apos;espace client seront effacés, et cette
              action ne peut pas être annulée. Pour simplement retirer ce client de la liste en
              gardant son historique, archivez-le plutôt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={pending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
