"use client";

import {
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
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
import {
  allowedTransitions,
  QUOTE_STATUS_LABELS,
  transitionLabel,
  type QuoteStatus,
} from "@/domain/quote-status";
import {
  changeQuoteStatusAction,
  deleteQuoteAction,
  duplicateQuoteAction,
} from "@/modules/quotes/actions";

type Props = {
  quote: { id: string; number: string; status: QuoteStatus };
  canEdit: boolean;
};

/** Actions d'un devis : PDF, modification, changements de statut, duplication, suppression. */
export function QuoteActions({ quote, canEdit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const transitions = allowedTransitions(quote.status).filter((to) => to !== "EXPIRED") as Exclude<
    QuoteStatus,
    "EXPIRED"
  >[];
  const pdf = `/api/devis/${quote.id}/pdf`;

  function changeStatus(status: (typeof transitions)[number]) {
    startTransition(async () => {
      const result = await changeQuoteStatusAction({ id: quote.id, status });
      if (result.ok)
        toast.success(`Devis ${quote.number} : ${QUOTE_STATUS_LABELS[status].toLowerCase()}.`);
      else toast.error(result.error);
    });
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateQuoteAction({ id: quote.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Copie créée : ${result.data.number}.`);
      router.push(`/devis/${result.data.id}`);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteQuoteAction({ id: quote.id });
      if (!result.ok) {
        toast.error(result.error);
        setConfirmDelete(false);
        return;
      }
      toast.success(`Devis ${quote.number} supprimé.`);
      router.replace("/devis");
    });
  }

  // Action principale mise en avant : faire avancer le devis (jamais une annulation).
  const primary = canEdit
    ? transitions.find((t) => t === "ACCEPTED" || (t === "SENT" && quote.status === "DRAFT"))
    : undefined;

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a href={pdf} target="_blank" rel="noopener">
          <EyeIcon /> Aperçu PDF
        </a>
      </Button>
      <Button asChild variant="outline">
        <a href={`${pdf}?telecharger=1`} download>
          <DownloadIcon /> PDF
        </a>
      </Button>
      {canEdit && quote.status === "DRAFT" && (
        <Button asChild variant="outline">
          <Link href={`/devis/${quote.id}/modifier`}>
            <PencilIcon /> Modifier
          </Link>
        </Button>
      )}
      {primary && (
        <Button onClick={() => changeStatus(primary)} disabled={pending}>
          {transitionLabel(quote.status, primary)}
        </Button>
      )}
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Autres actions" disabled={pending}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {transitions
              .filter((to) => to !== primary)
              .map((to) => (
                <DropdownMenuItem key={to} onSelect={() => changeStatus(to)}>
                  {transitionLabel(quote.status, to)}
                </DropdownMenuItem>
              ))}
            <DropdownMenuItem onSelect={duplicate}>
              <CopyIcon /> Dupliquer
            </DropdownMenuItem>
            {quote.status === "DRAFT" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2Icon /> Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le devis {quote.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce brouillon sera définitivement supprimé. Son numéro ne sera pas réattribué.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={pending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
