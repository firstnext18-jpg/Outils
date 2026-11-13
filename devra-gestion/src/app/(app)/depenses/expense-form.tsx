"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClientPicker } from "@/components/documents/editor/client-picker";
import { FilePicker } from "@/components/files/file-picker";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadProblem } from "@/domain/files";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/domain/invoice-status";
import { formatPercent } from "@/domain/percent";
import { createExpenseAction, updateExpenseAction } from "@/modules/expenses/actions";
import type { PickerClient } from "@/modules/clients/service";

const NONE = "__aucun__";

export type ExpenseFormValues = {
  date: string;
  supplier: string;
  description: string;
  categoryId: string | null;
  amount: string;
  vatRateBps: number | null;
  method: PaymentMethod;
  clientId: string | null;
  projectId: string | null;
  notes: string;
};

/** Saisie ou modification d'une dépense (justificatifs joints à la création). */
export function ExpenseForm({
  expenseId,
  defaultValues,
  client: initialClient,
  categories,
  vatRates,
  projects,
}: {
  expenseId?: string;
  defaultValues: ExpenseFormValues;
  client: PickerClient | null;
  categories: { id: string; name: string }[];
  /** Taux proposés (TVA activée), en points de base ; vide sinon. */
  vatRates: number[];
  projects: { id: string; name: string; clientId: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(defaultValues);
  const [client, setClient] = useState(initialClient);
  const [receipts, setReceipts] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<ExpenseFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const clientProjects = projects.filter((p) => p.clientId === values.clientId);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      let result;
      if (expenseId) {
        result = await updateExpenseAction({ id: expenseId, expense: values });
      } else {
        const form = new FormData();
        form.set("expense", JSON.stringify(values));
        for (const file of receipts) form.append("files", file);
        result = await createExpenseAction(form);
      }
      if (!result.ok) {
        setError(Object.values(result.fieldErrors ?? {})[0]?.[0] ?? result.error);
        return;
      }
      toast.success(expenseId ? "Dépense enregistrée." : "Dépense ajoutée.");
      router.push(expenseId ? `/depenses/${expenseId}` : "/depenses");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={error} />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expense-date">Date</Label>
            <Input
              id="expense-date"
              type="date"
              value={values.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-amount">Montant payé (CHF, TVA comprise)</Label>
            <Input
              id="expense-amount"
              inputMode="decimal"
              value={values.amount}
              onChange={(e) => set({ amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-supplier">Fournisseur</Label>
            <Input
              id="expense-supplier"
              value={values.supplier}
              maxLength={120}
              placeholder="ex. Infomaniak"
              onChange={(e) => set({ supplier: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              value={values.description}
              maxLength={200}
              placeholder="ex. Hébergement annuel"
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-category">Catégorie</Label>
            <Select
              value={values.categoryId ?? NONE}
              onValueChange={(v) => set({ categoryId: v === NONE ? null : v })}
            >
              <SelectTrigger id="expense-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sans catégorie</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-method">Payé par</Label>
            <Select
              value={values.method}
              onValueChange={(v) => set({ method: v as PaymentMethod })}
            >
              <SelectTrigger id="expense-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {vatRates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="expense-vat">TVA comprise (impôt préalable)</Label>
              <Select
                value={values.vatRateBps === null ? NONE : String(values.vatRateBps)}
                onValueChange={(v) => set({ vatRateBps: v === NONE ? null : Number(v) })}
              >
                <SelectTrigger id="expense-vat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sans TVA</SelectItem>
                  {vatRates.map((rate) => (
                    <SelectItem key={rate} value={String(rate)}>
                      {formatPercent(rate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="expense-client">Client ou projet concerné (facultatif)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 gap-1">
                <ClientPicker
                  id="expense-client"
                  value={client}
                  onChange={(picked) => {
                    setClient(picked);
                    set({ clientId: picked.id, projectId: null });
                  }}
                />
                {client && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Retirer le client"
                    onClick={() => {
                      setClient(null);
                      set({ clientId: null, projectId: null });
                    }}
                  >
                    <XIcon />
                  </Button>
                )}
              </div>
              {clientProjects.length > 0 && (
                <Select
                  value={values.projectId ?? NONE}
                  onValueChange={(v) => set({ projectId: v === NONE ? null : v })}
                >
                  <SelectTrigger className="sm:w-60" aria-label="Projet">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sans projet</SelectItem>
                    {clientProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="expense-notes">Notes</Label>
            <Textarea
              id="expense-notes"
              rows={2}
              value={values.notes}
              maxLength={2000}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
          {!expenseId && (
            <div className="space-y-2 md:col-span-2">
              <Label>Justificatifs</Label>
              <div className="flex flex-wrap items-center gap-2">
                <FilePicker
                  label="Joindre la facture du fournisseur"
                  onPick={(files) => {
                    const all = [...receipts, ...files].slice(0, 5);
                    const problem = uploadProblem(all);
                    if (problem) return toast.error(problem);
                    setReceipts(all);
                  }}
                />
                {receipts.map((file, i) => (
                  <span
                    key={`${file.name}-${i}`}
                    className="bg-muted flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                  >
                    {file.name}
                    <button
                      type="button"
                      aria-label={`Retirer ${file.name}`}
                      onClick={() => setReceipts((all) => all.filter((_, j) => j !== i))}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : expenseId ? "Enregistrer" : "Ajouter la dépense"}
      </Button>
    </form>
  );
}
