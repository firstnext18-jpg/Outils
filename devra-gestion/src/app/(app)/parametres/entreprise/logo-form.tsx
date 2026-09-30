"use client";

/* eslint-disable @next/next/no-img-element -- aperçu du logo servi par l'API */
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useTransition } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { removeLogoAction, uploadLogoAction } from "@/modules/settings/actions";
import { LOGO_MAX_BYTES } from "@/modules/settings/schemas";

export function LogoForm({ logoFile }: { logoFile: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Le logo ne doit pas dépasser 2 Mo.");
      return;
    }
    const formData = new FormData();
    formData.set("logo", file);
    startTransition(async () => {
      const result = await uploadLogoAction(formData);
      if (result.ok) toast.success("Logo enregistré.");
      else toast.error(result.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeLogoAction({});
      if (result.ok) toast.success("Logo supprimé.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex h-24 w-48 items-center justify-center rounded-md border bg-white p-3">
        {logoFile ? (
          <img
            src={`/api/logo?v=${encodeURIComponent(logoFile)}`}
            alt="Logo actuel"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <ImageIcon className="size-8 text-zinc-400" aria-label="Aucun logo" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          aria-label="Fichier du logo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon /> {logoFile ? "Remplacer le logo" : "Ajouter un logo"}
        </Button>
        {logoFile && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                <Trash2Icon /> Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer le logo ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Les prochains documents seront générés sans logo. Vous pourrez en ajouter un
                  nouveau à tout moment.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
