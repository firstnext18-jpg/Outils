"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { TotalsSummary } from "@/components/documents/totals-summary";
import type { PickerCatalogItem } from "@/components/documents/editor/catalog-picker";
import { DocumentDiscountField } from "@/components/documents/editor/discount-field";
import { DocumentHeaderCard } from "@/components/documents/editor/header-card";
import { DocumentLinesCard } from "@/components/documents/editor/lines-card";
import {
  EditorMobileBar,
  EditorSidebarButtons,
} from "@/components/documents/editor/submit-buttons";
import { DocumentTextsCard } from "@/components/documents/editor/texts-card";
import { useClientAndLanguage } from "@/components/documents/editor/use-client-language";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { FormError } from "@/components/forms/form-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { computeTotals } from "@/domain/totals";
import type { PickerClient } from "@/modules/clients/service";
import { createQuoteAction, updateQuoteAction } from "@/modules/quotes/actions";
import { previewTotalsInput } from "@/modules/quotes/form";
import { quoteInputSchema, type QuoteData, type QuoteInput } from "@/modules/quotes/schemas";
import type { QuoteEditorSettings } from "@/modules/settings/documents";

type Props = {
  defaults: QuoteInput;
  initialClient: PickerClient | null;
  settings: QuoteEditorSettings;
  catalog: PickerCatalogItem[];
  siteTypes: { id: string; name: string }[];
  /** Absent pour un nouveau devis. */
  existing?: { id: string; version: number; number: string };
};

export function QuoteEditor(props: Props) {
  const form = useForm<QuoteInput, unknown, QuoteData>({
    resolver: zodResolver(quoteInputSchema),
    defaultValues: props.defaults,
  });
  return (
    <Form {...form}>
      <QuoteEditorForm {...props} />
    </Form>
  );
}

function QuoteEditorForm({ initialClient, settings, catalog, siteTypes, existing }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    getValues,
    handleSubmit,
    setError: setFieldError,
    formState,
  } = useFormContextAsQuote();
  const { client, pickClient, changeLanguage } = useClientAndLanguage(settings, initialClient);
  const values = useWatch({ control }) as QuoteInput;

  // Mêmes calculs que le serveur, pour afficher les montants pendant la saisie.
  const preview = previewTotalsInput(values);
  const totals = useMemo(
    () => computeTotals({ ...previewTotalsInput(values), vatEnabled: settings.vatEnabled }),
    [values, settings.vatEnabled],
  );

  async function onSubmit() {
    setError(null);
    // Le serveur revalide les données saisies (textes) avec le même schéma.
    const quote = getValues();
    const result = existing
      ? await updateQuoteAction({ id: existing.id, version: existing.version, quote })
      : await createQuoteAction({ quote });
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(setFieldError, result.fieldErrors, "quote.");
      return;
    }
    toast.success(existing ? `Devis ${existing.number} enregistré.` : "Devis créé.");
    router.push(`/devis/${result.data.id}`);
    router.refresh();
  }

  const submitLabel = formState.isSubmitting
    ? "Enregistrement…"
    : existing
      ? "Enregistrer"
      : "Créer le devis";
  const cancelHref = existing ? `/devis/${existing.id}` : "/devis";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_20rem]"
    >
      <div className="min-w-0 space-y-6">
        <FormError message={error} />
        <DocumentHeaderCard
          client={client}
          onPickClient={pickClient}
          onChangeLanguage={changeLanguage}
          siteTypes={siteTypes}
          issueDateLabel="Date du devis"
          secondDate={{
            name: "validUntil",
            label: "Valable jusqu'au",
            offsetDays: settings.quoteValidityDays,
          }}
          existing={Boolean(existing)}
        />
        <DocumentLinesCard
          catalog={catalog}
          settings={settings}
          lineTotals={totals.lines.map((line) => line.netCents)}
        />
        <DocumentTextsCard />
      </div>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Montants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <TotalsSummary
              totals={totals}
              globalDiscount={preview.globalDiscount}
              deposit={preview.deposit}
              vatEnabled={settings.vatEnabled}
            />
            <DocumentDiscountField
              valueName="globalDiscountValue"
              typeName="globalDiscountType"
              label="Remise globale"
              help="S'ajoute aux remises de ligne ; ne s'applique pas aux abonnements."
            />
            <DocumentDiscountField
              valueName="depositValue"
              typeName="depositType"
              label="Acompte à la commande"
              help="Calculé sur le montant unique, arrondi aux 5 centimes."
            />
            <EditorSidebarButtons
              label={submitLabel}
              cancelHref={cancelHref}
              pending={formState.isSubmitting}
            />
          </CardContent>
        </Card>
      </div>

      <EditorMobileBar
        label={submitLabel}
        cancelHref={cancelHref}
        pending={formState.isSubmitting}
      />
    </form>
  );
}

/** Le formulaire du devis, typé avec ses propres champs (et non les seuls champs communs). */
function useFormContextAsQuote() {
  return useFormContext<QuoteInput, unknown, QuoteData>();
}
