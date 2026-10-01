"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { FormError } from "@/components/forms/form-error";
import { MoneyInput } from "@/components/forms/money-input";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayIso } from "@/domain/dates";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/domain/invoice-status";
import { formatAmount, formatChf } from "@/lib/format";
import { recordPaymentAction } from "@/modules/invoices/actions";
import {
  paymentInputSchema,
  type PaymentData,
  type PaymentInput,
} from "@/modules/invoices/schemas";

export type InvoiceRef = { id: string; number: string; balanceCents: number };

/** Enregistrement d'un paiement (total ou partiel). */
export function PaymentDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: InvoiceRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            Facture {invoice.number} · solde {formatChf(invoice.balanceCents)}
          </DialogDescription>
        </DialogHeader>
        {/* Monté à chaque ouverture : le montant proposé est toujours le solde à jour. */}
        <PaymentForm invoice={invoice} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Formulaire de paiement d'une facture (`onCancel` : bouton « Annuler », par défaut `onDone`). */
export function PaymentForm({
  invoice,
  onDone,
  onCancel = onDone,
  cancelLabel = "Annuler",
}: {
  invoice: InvoiceRef;
  onDone: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const defaults: PaymentInput = {
    invoiceId: invoice.id,
    date: todayIso(),
    amount: formatAmount(invoice.balanceCents),
    method: "BANK_TRANSFER",
    note: "",
  };
  const form = useForm<PaymentInput, unknown, PaymentData>({
    resolver: zodResolver(paymentInputSchema),
    defaultValues: defaults,
  });

  async function onSubmit() {
    setError(null);
    const values = form.getValues();
    const result = await recordPaymentAction(values);
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(form.setError, result.fieldErrors);
      return;
    }
    const amount = paymentInputSchema.parse(values).amountCents;
    toast.success(
      result.data.balanceCents === 0
        ? `Paiement de ${formatChf(amount)} enregistré : la facture ${invoice.number} est payée.`
        : `Paiement de ${formatChf(amount)} enregistré. Solde : ${formatChf(result.data.balanceCents)}.`,
    );
    onDone();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date du paiement</FormLabel>
                <FormControl>
                  <Input type="date" max={todayIso()} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant</FormLabel>
                <FormControl>
                  <MoneyInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Moyen de paiement</FormLabel>
              <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue>{PAYMENT_METHOD_LABELS[field.value]}</SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <TextField
          control={form.control}
          name="note"
          label="Note (facultatif)"
          placeholder="ex. Extrait bancaire du 15.10"
          autoComplete="off"
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer le paiement"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
