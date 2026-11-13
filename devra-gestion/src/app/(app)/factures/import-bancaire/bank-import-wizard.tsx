"use client";

import { CircleAlertIcon, CircleCheckIcon, UploadIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIsoDate } from "@/domain/dates";
import { formatChf } from "@/lib/format";
import { importBankPaymentsAction, previewBankFileAction } from "@/modules/bank/actions";
import type { OpenInvoiceOption, PreviewRow } from "@/modules/bank/service";

const NONE = "__aucune__";

const HOW_LABELS = {
  reference: "Référence QR",
  number: "N° de facture",
  amount: "Montant à vérifier",
} as const;

type Row = PreviewRow & { selected: boolean; invoiceId: string | null };

/** Import d'un relevé : fichier → propositions → paiements enregistrés. */
export function BankImportWizard() {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [invoices, setInvoices] = useState<OpenInvoiceOption[]>([]);
  const [results, setResults] = useState<{ key: string; ok: boolean; message: string }[] | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const selected = rows?.filter((r) => r.selected && r.invoiceId) ?? [];

  function read(file: File) {
    const form = new FormData();
    form.set("file", file);
    setResults(null);
    startTransition(async () => {
      const result = await previewBankFileAction(form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFileName(file.name);
      setInvoices(result.data.invoices);
      setRows(
        result.data.rows.map((row) => ({
          ...row,
          invoiceId: row.match.invoiceId,
          // Rapprochements sûrs cochés d'office ; « montant à vérifier » laissé à l'utilisateur.
          selected:
            !row.alreadyImported && (row.match.how === "reference" || row.match.how === "number"),
        })),
      );
    });
  }

  function update(key: string, patch: Partial<Row>) {
    setRows(
      (current) => current?.map((row) => (row.key === key ? { ...row, ...patch } : row)) ?? null,
    );
  }

  function confirm() {
    startTransition(async () => {
      const result = await importBankPaymentsAction({
        fileName,
        rows: selected.map((row) => ({
          key: row.key,
          bookingDate: row.bookingDate,
          amountCents: row.amountCents,
          reference: row.reference,
          remittance: row.remittance,
          debtorName: row.debtorName,
          invoiceId: row.invoiceId!,
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.paymentCount} paiement(s) enregistré(s).`);
      setResults(result.data.results);
      setRows(null);
    });
  }

  return (
    <div className="space-y-4">
      <input
        ref={input}
        type="file"
        accept=".xml,application/xml,text/xml"
        hidden
        aria-label="Relevé bancaire (camt.053 ou camt.054)"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) read(file);
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={pending}>
        <UploadIcon /> {pending && !rows ? "Lecture…" : "Choisir le fichier du relevé"}
      </Button>

      {results && (
        <ul className="space-y-1 text-sm" aria-label="Résultat de l'import">
          {results.map((r) => (
            <li key={r.key} className="flex items-center gap-2">
              {r.ok ? (
                <CircleCheckIcon className="text-success size-4" />
              ) : (
                <CircleAlertIcon className="text-destructive size-4" />
              )}
              {r.message}
            </li>
          ))}
        </ul>
      )}

      {rows && rows.length === 0 && (
        <p className="text-muted-foreground text-sm">Aucun crédit en CHF dans ce fichier.</p>
      )}

      {rows && rows.length > 0 && (
        <>
          <p className="text-sm">
            <strong>{fileName}</strong> : {rows.length} crédit(s). Vérifiez la facture proposée pour
            chaque paiement, puis enregistrez ceux qui sont cochés.
          </p>
          <ul className="divide-y rounded-md border" aria-label="Crédits du relevé">
            {rows.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <Checkbox
                  checked={row.selected}
                  disabled={row.alreadyImported || !row.invoiceId}
                  aria-label={`Enregistrer ${formatChf(row.amountCents)} de ${row.debtorName || "inconnu"}`}
                  onCheckedChange={(value) => update(row.key, { selected: value === true })}
                />
                <div className="min-w-48 flex-1">
                  <div className="font-medium">
                    {formatChf(row.amountCents)} · {formatIsoDate(row.bookingDate)}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {[row.debtorName, row.reference, row.remittance].filter(Boolean).join(" · ") ||
                      "—"}
                  </div>
                </div>
                {row.alreadyImported ? (
                  <Badge variant="outline">Déjà importé</Badge>
                ) : (
                  <>
                    {row.match.how && row.invoiceId === row.match.invoiceId && (
                      <Badge variant={row.match.how === "amount" ? "outline" : "secondary"}>
                        {HOW_LABELS[row.match.how]}
                      </Badge>
                    )}
                    <Select
                      value={row.invoiceId ?? NONE}
                      onValueChange={(value) =>
                        update(row.key, {
                          invoiceId: value === NONE ? null : value,
                          selected: value !== NONE,
                        })
                      }
                    >
                      <SelectTrigger
                        className="w-72"
                        aria-label={`Facture pour ${formatChf(row.amountCents)}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Aucune facture (ignorer)</SelectItem>
                        {invoices.map((invoice) => (
                          <SelectItem key={invoice.id} value={invoice.id}>
                            {invoice.number} · {invoice.client} · solde{" "}
                            {formatChf(invoice.outstandingCents)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </li>
            ))}
          </ul>
          <Button onClick={confirm} disabled={pending || selected.length === 0}>
            {pending ? "Enregistrement…" : `Enregistrer ${selected.length} paiement(s)`}
          </Button>
        </>
      )}
    </div>
  );
}
