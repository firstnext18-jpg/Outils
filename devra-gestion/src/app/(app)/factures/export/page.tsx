import type { Metadata } from "next";
import { FileArchiveIcon, FileSpreadsheetIcon } from "lucide-react";
import Link from "next/link";
import { FormError } from "@/components/forms/form-error";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportPresets } from "@/domain/accounting";
import { describeRange } from "@/domain/dashboard";
import { todayIso } from "@/domain/dates";
import { cn } from "@/lib/utils";
import {
  EXPORT_DATASETS,
  exportCounts,
  exportRangeSchema,
  MAX_PDFS_PER_ARCHIVE,
} from "@/modules/exports/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Export comptable" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`;
}

export default async function AccountingExportPage({
  searchParams,
}: PageProps<"/factures/export">) {
  await requireUser();
  const today = todayIso();
  const presets = exportPresets(today);
  const query = await searchParams;
  const defaultRange = presets[2]!.range; // année en cours
  const requested = {
    du: first(query.du) ?? defaultRange.from,
    au: first(query.au) ?? defaultRange.to,
  };
  const parsed = exportRangeSchema.safeParse(requested);
  const range = parsed.success ? parsed.data : null;
  const counts = range ? await exportCounts(range) : null;
  const qs = range ? `du=${range.from}&au=${range.to}` : "";
  const pdfCount = counts ? counts.invoices + counts.reminders : 0;

  return (
    <>
      <PageHeader
        title="Export comptable"
        description="Factures, paiements et clients d'une période, en Excel ou en CSV, et les PDF en un seul fichier ZIP."
      />

      <Card>
        <CardHeader>
          <CardTitle>Période</CardTitle>
          <CardDescription>
            Factures selon leur date, paiements selon leur date de réception.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <nav aria-label="Périodes proposées" className="flex flex-wrap gap-2">
            {presets.map((preset) => {
              const active = range?.from === preset.range.from && range?.to === preset.range.to;
              return (
                <Link
                  key={preset.label}
                  href={`/factures/export?du=${preset.range.from}&au=${preset.range.to}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                  )}
                >
                  {preset.label}
                </Link>
              );
            })}
          </nav>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="export-from">Du</Label>
              <Input id="export-from" name="du" type="date" defaultValue={requested.du} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="export-to">Au</Label>
              <Input id="export-to" name="au" type="date" defaultValue={requested.au} required />
            </div>
            <Button type="submit" variant="outline">
              Afficher
            </Button>
          </form>
          {!parsed.success && (
            <FormError message={parsed.error.issues[0]?.message ?? "Période invalide."} />
          )}
          {range && counts && (
            <p className="text-sm">
              Période : {describeRange(range)} ·{" "}
              {plural(counts.invoices, "facture émise", "factures émises")},{" "}
              {plural(counts.payments, "paiement", "paiements")},{" "}
              {plural(counts.reminders, "relance", "relances")}.
            </p>
          )}
        </CardContent>
      </Card>

      {range && counts && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tableurs</CardTitle>
              <CardDescription>
                Montants en francs (sans séparateur de milliers dans les CSV), dates au format
                JJ.MM.AAAA. Les factures annulées sont incluses avec leur statut.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild>
                <a href={`/api/export/comptable?${qs}&format=xlsx`} download>
                  <FileSpreadsheetIcon /> Classeur Excel (factures, paiements, clients)
                </a>
              </Button>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Fichiers CSV :</span>
                {Object.entries(EXPORT_DATASETS).map(([key, dataset]) => (
                  <Button key={key} asChild variant="outline" size="sm">
                    <a href={`/api/export/comptable?${qs}&format=csv&jeu=${key}`} download>
                      {dataset.label}
                    </a>
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                Clients : ceux facturés ou ayant payé pendant la période, avec leurs totaux et leur
                solde ouvert à ce jour.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents PDF</CardTitle>
              <CardDescription>
                Les PDF archivés des factures émises (dossier « factures ») et des relances (dossier
                « relances ») de la période, tels qu&apos;ils ont été envoyés.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pdfCount > MAX_PDFS_PER_ARCHIVE ? (
                <p className="text-destructive text-sm">
                  {pdfCount} documents : {MAX_PDFS_PER_ARCHIVE} au plus par archive. Choisissez une
                  période plus courte.
                </p>
              ) : pdfCount === 0 ? (
                <p className="text-muted-foreground text-sm">Aucun document sur cette période.</p>
              ) : (
                <Button asChild variant="outline">
                  <a href={`/api/export/pdf?${qs}`} download>
                    <FileArchiveIcon /> Télécharger les PDF (ZIP, {pdfCount} fichier
                    {pdfCount > 1 ? "s" : ""})
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
