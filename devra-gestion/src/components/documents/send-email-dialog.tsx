"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PaperclipIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { FormError } from "@/components/forms/form-error";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { sendDocumentEmailAction } from "@/modules/emails/actions";
import { sendEmailSchema, type SendEmailData, type SendEmailInput } from "@/modules/emails/schemas";

export type SendEmailProps = {
  kind: "quote" | "invoice" | "reminder";
  documentId: string;
  /** Facture en brouillon : version lue (elle est émise avant l'envoi). */
  version?: number;
  /** Valeurs proposées : destinataire du client, modèle de la langue du document. */
  draft: { to: string; subject: string; body: string };
  /** Nom du PDF joint (ou description s'il n'est pas encore connu). */
  attachment: string;
  /** Avertissement affiché en tête (ex. émission de la facture). */
  note?: string;
  senderEmail: string;
  title?: string;
};

/** Envoi d'un devis ou d'une facture par email, PDF en pièce jointe. */
export function SendEmailDialog({
  open,
  onOpenChange,
  ...props
}: SendEmailProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.title ?? "Envoyer par email"}</DialogTitle>
          <DialogDescription>
            Vous pouvez modifier le message avant l&apos;envoi. Le modèle se règle dans Paramètres →
            Emails.
          </DialogDescription>
        </DialogHeader>
        {/* Monté à chaque ouverture : les valeurs proposées sont toujours à jour. */}
        <SendEmailForm {...props} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SendEmailForm({
  kind,
  documentId,
  version,
  draft,
  attachment,
  note,
  senderEmail,
  onDone,
}: SendEmailProps & { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SendEmailInput, unknown, SendEmailData>({
    resolver: zodResolver(sendEmailSchema),
    defaultValues: {
      kind,
      id: documentId,
      version,
      to: draft.to,
      subject: draft.subject,
      body: draft.body,
      copyToSender: false,
    },
  });

  async function onSubmit() {
    setError(null);
    const values = form.getValues();
    const result = await sendDocumentEmailAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(form.setError, result.fieldErrors);
      return;
    }
    const recipients = sendEmailSchema.parse(values).to.join(", ");
    toast.success(
      kind === "quote"
        ? `Devis ${result.data.number} envoyé à ${recipients}.`
        : kind === "reminder"
          ? `Relance de la facture ${result.data.number} envoyée à ${recipients}.`
          : `Facture ${result.data.number} envoyée à ${recipients}.`,
    );
    onDone();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormError message={error} />
        {note && <p className="bg-muted rounded-md p-3 text-sm">{note}</p>}
        <TextField
          control={form.control}
          name="to"
          label="Destinataires"
          description="Plusieurs adresses : séparez-les par des virgules."
          placeholder="client@exemple.ch"
          autoComplete="off"
        />
        <TextField control={form.control} name="subject" label="Objet" autoComplete="off" />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea rows={11} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <PaperclipIcon className="size-4 shrink-0" />
          <span className="truncate">{attachment}</span>
        </p>
        <FormField
          control={form.control}
          name="copyToSender"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              </FormControl>
              <FormLabel className="!mt-0 font-normal">
                M&apos;envoyer une copie ({senderEmail})
              </FormLabel>
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Envoi…" : "Envoyer"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
