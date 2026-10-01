"use client";

import { Trash2Icon } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIsoDate } from "@/domain/dates";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/domain/invoice-status";
import { formatChf } from "@/lib/format";
import { deletePaymentAction } from "@/modules/invoices/actions";

type PaymentRow = {
  id: string;
  date: string;
  amountCents: number;
  method: PaymentMethod;
  note: string;
  createdBy: string | null;
};

/** Paiements reçus, avec suppression (en cas d'erreur de saisie). */
export function PaymentsCard({
  invoiceId,
  payments,
  canDelete,
}: {
  invoiceId: string;
  payments: PaymentRow[];
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<PaymentRow | null>(null);

  function remove(payment: PaymentRow) {
    startTransition(async () => {
      const result = await deletePaymentAction({ id: payment.id, invoiceId });
      setToDelete(null);
      if (result.ok) toast.success(`Paiement de ${formatChf(payment.amountCents)} supprimé.`);
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paiements</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun paiement enregistré.</p>
        ) : (
          <ul className="divide-y text-sm">
            {payments.map((payment) => (
              <li key={payment.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-x-3">
                    <span className="tabular-nums">{formatIsoDate(payment.date)}</span>
                    <span className="text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </span>
                  </div>
                  {payment.note && <p className="text-muted-foreground">{payment.note}</p>}
                  {payment.createdBy && (
                    <p className="text-muted-foreground text-xs">Saisi par {payment.createdBy}</p>
                  )}
                </div>
                <span className="font-medium whitespace-nowrap tabular-nums">
                  {formatChf(payment.amountCents)}
                </span>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Supprimer le paiement du ${formatIsoDate(payment.date)}`}
                    onClick={() => setToDelete(payment)}
                    disabled={pending}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete &&
                `Paiement de ${formatChf(toDelete.amountCents)} du ${formatIsoDate(toDelete.date)}. Le solde de la facture sera recalculé.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && remove(toDelete)}
              disabled={pending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
