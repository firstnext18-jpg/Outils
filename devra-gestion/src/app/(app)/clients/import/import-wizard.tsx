"use client";

import {
  CircleAlertIcon,
  CircleCheckIcon,
  CopyIcon,
  FileSpreadsheetIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { FormError } from "@/components/forms/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { guessMapping, IMPORT_FIELDS, type ImportMapping } from "@/domain/client-import";
import { cn } from "@/lib/utils";
import {
  commitImportAction,
  parseImportFileAction,
  previewImportAction,
} from "@/modules/clients/import-actions";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "@/modules/clients/import-limits";
import type { ImportPreview, ImportRowStatus } from "@/modules/clients/import-schemas";

type Step = "file" | "mapping" | "preview" | "done";
type Table = { fileName: string; headers: string[]; rows: string[][] };
type Result = { created: number; skippedErrors: number; skippedDuplicates: number };

const IGNORE = "__ignorer__";
const STEPS: { key: Step; label: string }[] = [
  { key: "file", label: "Fichier" },
  { key: "mapping", label: "Colonnes" },
  { key: "preview", label: "Vérification" },
  { key: "done", label: "Terminé" },
];

export function ImportWizard() {
  const [step, setStep] = useState<Step>("file");
  const [table, setTable] = useState<Table | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [duplicates, setDuplicates] = useState<"skip" | "import">("skip");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    setError(null);
    if (file.size > IMPORT_MAX_BYTES) {
      setError("Le fichier dépasse 5 Mo.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const response = await parseImportFileAction(formData);
      if (inputRef.current) inputRef.current.value = "";
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setTable(response.data);
      setMapping(guessMapping(response.data.headers));
      setStep("mapping");
    });
  }

  function checkRows() {
    if (!table) return;
    setError(null);
    startTransition(async () => {
      const response = await previewImportAction({ table, mapping });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setPreview(response.data);
      setStep("preview");
    });
  }

  function runImport() {
    if (!table) return;
    setError(null);
    startTransition(async () => {
      const response = await commitImportAction({
        table,
        mapping,
        fileName: table.fileName,
        duplicates,
      });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResult(response.data);
      setStep("done");
    });
  }

  function restart() {
    setStep("file");
    setTable(null);
    setMapping({});
    setPreview(null);
    setResult(null);
    setError(null);
  }

  const toImport = preview
    ? preview.counts.ok + (duplicates === "import" ? preview.counts.duplicate : 0)
    : 0;

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            aria-current={s.key === step ? "step" : undefined}
            className={cn(
              "flex items-center gap-2",
              s.key === step ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs",
                s.key === step && "border-foreground bg-foreground text-background",
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </li>
        ))}
      </ol>

      <FormError message={error} />

      {step === "file" && (
        <Card>
          <CardHeader>
            <CardTitle>Choisir le fichier</CardTitle>
            <CardDescription>
              Formats acceptés : CSV (séparé par des points-virgules ou des virgules) et Excel
              (.xlsx). La première ligne doit contenir les intitulés des colonnes. {IMPORT_MAX_ROWS}{" "}
              lignes et 5 Mo au maximum.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              className={cn(
                "hover:bg-accent flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
                pending && "pointer-events-none opacity-60",
              )}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) readFile(file);
              }}
            >
              <FileSpreadsheetIcon className="text-muted-foreground size-10" />
              <span className="font-medium">
                {pending
                  ? "Lecture du fichier…"
                  : "Glissez un fichier ici ou cliquez pour le choisir"}
              </span>
              <span className="text-muted-foreground text-sm">.csv ou .xlsx</span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                aria-label="Fichier à importer"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) readFile(file);
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {step === "mapping" && table && (
        <Card>
          <CardHeader>
            <CardTitle>Associer les colonnes</CardTitle>
            <CardDescription>
              {table.fileName} · {table.rows.length} ligne{table.rows.length > 1 ? "s" : ""}. Les
              colonnes reconnues sont déjà associées : vérifiez et complétez. Une adresse « Rue du
              Lac 12 » dans une seule colonne est séparée automatiquement en rue et numéro.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            {IMPORT_FIELDS.map((field) => {
              const index = mapping[field.key];
              const sample =
                index !== undefined ? table.rows.find((r) => r[index])?.[index] : undefined;
              return (
                <div
                  key={field.key}
                  className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3"
                >
                  <Label htmlFor={`map-${field.key}`} className="leading-tight">
                    {field.label}
                  </Label>
                  <div className="min-w-0">
                    <Select
                      value={index === undefined ? IGNORE : String(index)}
                      onValueChange={(value) =>
                        setMapping((current) => {
                          const next = { ...current };
                          if (value === IGNORE) delete next[field.key];
                          else next[field.key] = Number(value);
                          return next;
                        })
                      }
                    >
                      <SelectTrigger
                        id={`map-${field.key}`}
                        className="w-full"
                        aria-label={`Colonne pour ${field.label}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORE}>— Ne pas importer —</SelectItem>
                        {table.headers.map((header, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {sample && (
                      <p className="text-muted-foreground mt-1 truncate text-xs">ex. : {sample}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="justify-between gap-2">
            <Button variant="ghost" onClick={restart} disabled={pending}>
              Changer de fichier
            </Button>
            <Button onClick={checkRows} disabled={pending}>
              {pending ? "Vérification…" : "Vérifier les données"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "preview" && preview && table && (
        <Card>
          <CardHeader>
            <CardTitle>Vérifier avant d&apos;importer</CardTitle>
            <CardDescription>Rien n&apos;est encore enregistré.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Summary
                icon={CircleCheckIcon}
                tone="success"
                count={preview.counts.ok}
                label="prêtes à importer"
              />
              <Summary
                icon={CopyIcon}
                tone="warning"
                count={preview.counts.duplicate}
                label="doublons (même email)"
              />
              <Summary
                icon={CircleAlertIcon}
                tone="destructive"
                count={preview.counts.error}
                label="à corriger (ignorées)"
              />
            </div>

            {preview.counts.duplicate > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Que faire des doublons ?</legend>
                <RadioGroup
                  value={duplicates}
                  onValueChange={(v) => setDuplicates(v as "skip" | "import")}
                >
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="skip" /> Les ignorer (recommandé)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="import" /> Les importer quand même (fiches en double)
                  </label>
                </RadioGroup>
              </fieldset>
            )}

            <PreviewTable preview={preview} />
          </CardContent>
          <CardFooter className="justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep("mapping")} disabled={pending}>
              Retour aux colonnes
            </Button>
            <Button onClick={runImport} disabled={pending || toImport === 0}>
              <UploadIcon />
              {pending
                ? "Import en cours…"
                : `Importer ${toImport} client${toImport > 1 ? "s" : ""}`}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "done" && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleCheckIcon className="text-success size-5" />
              {result.created} client{result.created > 1 ? "s" : ""} importé
              {result.created > 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              {[
                result.skippedDuplicates > 0 && `${result.skippedDuplicates} doublon(s) ignoré(s)`,
                result.skippedErrors > 0 && `${result.skippedErrors} ligne(s) en erreur ignorée(s)`,
              ]
                .filter(Boolean)
                .join(" · ") || "Toutes les lignes ont été importées."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
            <Button asChild>
              <Link href="/clients">Voir les clients</Link>
            </Button>
            <Button variant="outline" onClick={restart}>
              Importer un autre fichier
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function Summary({
  icon: Icon,
  tone,
  count,
  label,
}: {
  icon: typeof CircleCheckIcon;
  tone: "success" | "warning" | "destructive";
  count: number;
  label: string;
}) {
  const color = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Icon className={cn("size-5 shrink-0", color)} />
      <div>
        <div className="text-xl font-semibold tabular-nums">{count}</div>
        <div className="text-muted-foreground text-sm">{label}</div>
      </div>
    </div>
  );
}

const FILTERS: { key: "all" | ImportRowStatus; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "error", label: "À corriger" },
  { key: "duplicate", label: "Doublons" },
  { key: "ok", label: "Prêtes" },
];

const MAX_DISPLAYED = 300;

function PreviewTable({ preview }: { preview: ImportPreview }) {
  const [filter, setFilter] = useState<"all" | ImportRowStatus>(
    preview.counts.error > 0 ? "error" : "all",
  );
  const rows = preview.rows.filter((row) => filter === "all" || row.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les lignes">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "secondary" : "ghost"}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({f.key === "all" ? preview.rows.length : preview.counts[f.key]})
          </Button>
        ))}
      </div>
      <div className="max-h-[28rem] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-background sticky top-0">
            <TableRow>
              <TableHead className="w-16">Ligne</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="w-28">État</TableHead>
              <TableHead>Remarques</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, MAX_DISPLAYED).map((row) => (
              <TableRow key={row.line}>
                <TableCell className="text-muted-foreground tabular-nums">{row.line}</TableCell>
                <TableCell>
                  <div className="font-medium">{row.displayName || "—"}</div>
                  <div className="text-muted-foreground text-xs">
                    {[row.email, row.city].filter(Boolean).join(" · ")}
                  </div>
                </TableCell>
                <TableCell>
                  {row.status === "ok" && <Badge variant="secondary">Prête</Badge>}
                  {row.status === "duplicate" && <Badge variant="outline">Doublon</Badge>}
                  {row.status === "error" && <Badge variant="destructive">Erreur</Badge>}
                </TableCell>
                <TableCell className="text-sm whitespace-normal">
                  {row.errors.map((message) => (
                    <p key={message} className="text-destructive">
                      {message}
                    </p>
                  ))}
                  {row.duplicateOf && (
                    <p className="text-muted-foreground">
                      {row.duplicateOf === "existing"
                        ? "Un client avec cet email existe déjà."
                        : "Même email qu'une ligne précédente du fichier."}
                    </p>
                  )}
                  {row.warnings.map((message) => (
                    <p key={message} className="text-muted-foreground flex items-start gap-1">
                      <TriangleAlertIcon className="text-warning mt-0.5 size-3.5 shrink-0" />{" "}
                      {message}
                    </p>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > MAX_DISPLAYED && (
        <p className="text-muted-foreground text-sm">
          {MAX_DISPLAYED} premières lignes affichées sur {rows.length}.
        </p>
      )}
    </div>
  );
}
