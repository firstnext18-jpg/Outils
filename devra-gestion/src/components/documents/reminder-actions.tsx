"use client";

import { MailIcon, PrinterIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SendEmailDialog, type SendEmailProps } from "@/components/documents/send-email-dialog";
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
import { REMINDER_LEVEL_LABELS, type ReminderLevel } from "@/domain/reminders";
import { recordReminderAction } from "@/modules/reminders/actions";

/** Envoi d'une relance par email, ou enregistrement pour un envoi par courrier. */
export function ReminderActions({
  invoiceId,
  level,
  email,
  size = "default",
}: {
  invoiceId: string;
  level: ReminderLevel;
  email: Omit<SendEmailProps, "kind" | "documentId" | "version">;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState<"email" | "record" | null>(null);
  const [pending, startTransition] = useTransition();
  const label = REMINDER_LEVEL_LABELS[level];

  function record() {
    startTransition(async () => {
      const result = await recordReminderAction({ invoiceId });
      setOpen(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Relance enregistrée (${label.toLowerCase()}) : son PDF est prêt à imprimer.`);
      window.open(`/api/relances/${result.data.id}/pdf`, "_blank", "noopener");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} onClick={() => setOpen("email")} disabled={pending}>
        <MailIcon /> Envoyer : {label.toLowerCase()}
      </Button>
      <Button size={size} variant="outline" onClick={() => setOpen("record")} disabled={pending}>
        <PrinterIcon /> Par courrier
      </Button>

      <SendEmailDialog
        kind="reminder"
        documentId={invoiceId}
        title={`Envoyer : ${label.toLowerCase()}`}
        {...email}
        open={open === "email"}
        onOpenChange={(value) => setOpen(value ? "email" : null)}
      />
      <AlertDialog open={open === "record"} onOpenChange={(value) => !value && setOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Relance par courrier : {label.toLowerCase()}</AlertDialogTitle>
            <AlertDialogDescription>
              La relance est enregistrée dans l&apos;historique de la facture (avec ses frais
              éventuels) et son PDF s&apos;ouvre pour être imprimé et envoyé par courrier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={record} disabled={pending}>
              Enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
