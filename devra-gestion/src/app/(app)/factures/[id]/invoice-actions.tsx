"use client";

import {
  BanIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  MailIcon,
  PencilIcon,
  StampIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PaymentDialog } from "@/app/(app)/factures/[id]/payment-dialog";
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
import { SendEmailDialog, type SendEmailProps } from "@/components/documents/send-email-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canCancel, isOpen, type InvoiceStatus } from "@/domain/invoice-status";
import {
  cancelInvoiceAction,
  deleteInvoiceAction,
  duplicateInvoiceAction,
  issueInvoiceAction,
} from "@/modules/invoices/actions";

type Props = {
  invoice: {
    id: string;
    number: string | null;
    status: InvoiceStatus;
    version: number;
    paidCents: number;
    balanceCents: number;
  };
  canEdit: boolean;
  /** Ce qui manque dans les paramètres pour émettre (vide si tout y est). */
  issueBlockers: string[];
  email: Omit<SendEmailProps, "kind" | "documentId" | "version">;
};

type Dialog = "issue" | "cancel" | "delete" | "payment" | "email" | null;

/** Actions d'une facture : PDF, envoi, modification, émission, paiement, annulation, duplication. */
export function InvoiceActions({ invoice, canEdit, issueBlockers, email }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const pdf = `/api/factures/${invoice.id}/pdf`;
  const label = invoice.number ? `Facture ${invoice.number}` : "Brouillon de facture";
  const draft = invoice.status === "DRAFT";

  function issue() {
    startTransition(async () => {
      const result = await issueInvoiceAction({ id: invoice.id, version: invoice.version });
      setDialog(null);
      if (result.ok) toast.success(`Facture ${result.data.number} émise.`);
      else toast.error(result.error);
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelInvoiceAction({ id: invoice.id, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDialog(null);
      toast.success(`${label} annulée.`);
    });
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateInvoiceAction({ id: invoice.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Copie créée (brouillon).");
      router.push(`/factures/${result.data.id}`);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteInvoiceAction({ id: invoice.id });
      setDialog(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Brouillon de facture supprimé.");
      router.replace("/factures");
    });
  }

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
      {canEdit && draft && (
        <Button asChild variant="outline">
          <Link href={`/factures/${invoice.id}/modifier`}>
            <PencilIcon /> Modifier
          </Link>
        </Button>
      )}
      {canEdit && draft && (
        <Button
          onClick={() => setDialog(issueBlockers.length > 0 ? "issue" : "email")}
          disabled={pending}
        >
          <MailIcon /> Émettre et envoyer
        </Button>
      )}
      {canEdit && isOpen(invoice.status) && invoice.number && (
        <Button onClick={() => setDialog("payment")} disabled={pending}>
          Enregistrer un paiement
        </Button>
      )}
      {canEdit && !draft && invoice.status !== "CANCELLED" && (
        <Button variant="outline" onClick={() => setDialog("email")} disabled={pending}>
          <MailIcon /> Envoyer par email
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
            {draft && (
              <DropdownMenuItem onSelect={() => setDialog("issue")}>
                <StampIcon /> Émettre sans envoyer
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={duplicate}>
              <CopyIcon /> Dupliquer
            </DropdownMenuItem>
            {canCancel(invoice.status, invoice.paidCents) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    setReason("");
                    setDialog("cancel");
                  }}
                >
                  <BanIcon /> Annuler la facture
                </DropdownMenuItem>
              </>
            )}
            {draft && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                  <Trash2Icon /> Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canEdit && invoice.status !== "CANCELLED" && (
        <SendEmailDialog
          kind="invoice"
          documentId={invoice.id}
          version={draft ? invoice.version : undefined}
          {...email}
          open={dialog === "email"}
          onOpenChange={(open) => setDialog(open ? "email" : null)}
        />
      )}

      {invoice.number && (
        <PaymentDialog
          invoice={{ id: invoice.id, number: invoice.number, balanceCents: invoice.balanceCents }}
          open={dialog === "payment"}
          onOpenChange={(open) => setDialog(open ? "payment" : null)}
        />
      )}

      <AlertDialog open={dialog === "issue"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Émettre la facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              {issueBlockers.length > 0
                ? `Impossible pour l'instant : complétez d'abord dans Paramètres → Entreprise : ${issueBlockers.join(", ")}.`
                : "La facture reçoit son numéro définitif et sa QR-facture, puis elle est verrouillée : elle ne pourra plus être modifiée (en cas d'erreur, on l'annule et on en crée une nouvelle)."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            {issueBlockers.length === 0 && (
              <AlertDialogAction onClick={issue} disabled={pending}>
                Émettre
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "cancel"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la facture {invoice.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Elle garde son numéro et reste dans l&apos;historique, avec la mention « annulée ».
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motif de l&apos;annulation</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="ex. Erreur dans l'adresse, facture remplacée"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={cancel}
              disabled={pending || reason.trim().length < 3}
            >
              Annuler la facture
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce brouillon de facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Il n&apos;a pas encore de numéro : sa suppression ne laisse aucun trou dans la
              numérotation.
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
