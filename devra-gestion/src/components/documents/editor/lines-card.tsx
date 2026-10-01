"use client";

import { PlusIcon } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import {
  CatalogPicker,
  type PickerCatalogItem,
} from "@/components/documents/editor/catalog-picker";
import {
  useDocumentForm,
  type DocumentEditorSettings,
} from "@/components/documents/editor/form-context";
import { DocumentLineRow } from "@/components/documents/editor/line-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { emptyLine, lineFromCatalog } from "@/modules/documents/lines";

/** Lignes d'un devis ou d'une facture : catalogue, ligne libre, ordre, suppression. */
export function DocumentLinesCard({
  catalog,
  settings,
  lineTotals,
}: {
  catalog: PickerCatalogItem[];
  settings: DocumentEditorSettings;
  /** Montant net de chaque ligne, calculé pendant la saisie. */
  lineTotals: number[];
}) {
  const { control, getValues, formState } = useDocumentForm();
  const { fields, append, remove, move } = useFieldArray({ control, name: "lines" });
  const linesError = formState.errors.lines?.root?.message ?? formState.errors.lines?.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lignes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length > 0 ? (
          <ol className="space-y-3">
            {fields.map((field, index) => (
              <DocumentLineRow
                key={field.id}
                index={index}
                count={fields.length}
                netCents={lineTotals[index] ?? 0}
                vatEnabled={settings.vatEnabled}
                vatRates={settings.vatRates}
                onMove={move}
                onRemove={() => remove(index)}
              />
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            Aucune ligne. Ajoutez une prestation du catalogue ou une ligne libre.
          </p>
        )}
        {linesError && <p className="text-destructive text-sm">{linesError}</p>}
        <div className="flex flex-wrap gap-2">
          <CatalogPicker
            items={catalog}
            onPick={(item) =>
              append(lineFromCatalog(item, getValues("language"), settings.defaultVatRate))
            }
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => append(emptyLine(settings.defaultVatRate))}
          >
            <PlusIcon /> Ligne libre
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
