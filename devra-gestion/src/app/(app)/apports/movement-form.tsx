"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { formatChf } from "@/lib/format";
import {
  PARTNER_KIND_HELP,
  PARTNER_KIND_LABELS,
  PARTNER_KINDS,
  type PartnerKind,
} from "@/domain/partners";
import {
  createPartnerMovementAction,
  updatePartnerMovementAction,
} from "@/modules/partners/actions";

export type MovementFormValues = {
  partnerId: string;
  kind: PartnerKind;
  date: string;
  amount: string;
  description: string;
  notes: string;
};

/** Apport, prêt, remboursement ou retrait d'un associé (justificatifs joints à la création). */
export function MovementForm({
  movementId,
  defaultValues,
  partners,
  companyName,
}: {
  movementId?: string;
  defaultValues: MovementFormValues;
  partners: { id: string; name: string }[];
  /** Nom de l'entreprise (Paramètres), pour annoncer ses fonds après l'enregistrement. */
  companyName: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(defaultValues);
  const [receipts, setReceipts] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<MovementFormValues>) => setValues((v) => ({ ...v, ...patch }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      let result;
      if (movementId) {
        result = await updatePartnerMovementAction({ id: movementId, movement: values });
      } else {
        const form = new FormData();
        form.set("movement", JSON.stringify(values));
        for (const file of receipts) form.append("files", file);
        result = await createPartnerMovementAction(form);
      }
      if (!result.ok) {
        setError(Object.values(result.fieldErrors ?? {})[0]?.[0] ?? result.error);
        return;
      }
      toast.success(movementId ? "Mouvement enregistré." : "Mouvement ajouté.", {
        description: `Fonds de ${companyName} : ${formatChf(result.data.fundsCents)}`,
      });
      router.push(movementId ? `/apports/${movementId}` : "/apports");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={error} />
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="partner-id">Associé</Label>
            <Select value={values.partnerId} onValueChange={(partnerId) => set({ partnerId })}>
              <SelectTrigger id="partner-id" className="w-full">
                <SelectValue placeholder="Choisir l'associé" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner-kind">Type</Label>
            <Select
              value={values.kind}
              onValueChange={(kind) => set({ kind: kind as PartnerKind })}
            >
              <SelectTrigger id="partner-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTNER_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {PARTNER_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">{PARTNER_KIND_HELP[values.kind]}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner-date">Date</Label>
            <Input
              id="partner-date"
              type="date"
              value={values.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner-amount">Montant (CHF)</Label>
            <Input
              id="partner-amount"
              inputMode="decimal"
              value={values.amount}
              placeholder="ex. 5000"
              onChange={(e) => set({ amount: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="partner-description">Description (facultatif)</Label>
            <Input
              id="partner-description"
              value={values.description}
              maxLength={200}
              placeholder="ex. Apport initial, achat du matériel"
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="partner-notes">Notes</Label>
            <Textarea
              id="partner-notes"
              rows={2}
              value={values.notes}
              maxLength={2000}
              placeholder="ex. taux d'intérêt, échéance du remboursement"
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
          {!movementId && (
            <div className="space-y-2 md:col-span-2">
              <Label>Justificatifs</Label>
              <div className="flex flex-wrap items-center gap-2">
                <FilePicker
                  label="Joindre un relevé ou un contrat"
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
        {pending ? "Enregistrement…" : movementId ? "Enregistrer" : "Ajouter le mouvement"}
      </Button>
    </form>
  );
}
