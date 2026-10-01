"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";
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
import { TotalsSummary } from "@/components/documents/totals-summary";
import { applyServerFieldErrors } from "@/components/forms/apply-server-errors";
import { FormError } from "@/components/forms/form-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import type { Deduction } from "@/domain/invoices";
import { computeTotals } from "@/domain/totals";
import type { PickerClient } from "@/modules/clients/service";
import { createInvoiceAction, updateInvoiceAction } from "@/modules/invoices/actions";
import { previewInvoiceTotalsInput } from "@/modules/invoices/form";
import {
  invoiceInputSchema,
  type InvoiceData,
  type InvoiceInput,
} from "@/modules/invoices/schemas";
import type { InvoiceEditorSettings } from "@/modules/settings/documents";

type Props = {
  defaults: InvoiceInput;
  initialClient: PickerClient | null;
  settings: InvoiceEditorSettings;
  catalog: PickerCatalogItem[];
  siteTypes: { id: string; name: string }[];
  /** Absent pour une nouvelle facture. */
  existing?: { id: string; version: number };
  /** Facture finale : acomptes déduits (recalculés par le serveur à l'enregistrement). */
  deductions?: Deduction[];
};

export function InvoiceEditor(props: Props) {
  const form = useForm<InvoiceInput, unknown, InvoiceData>({
    resolver: zodResolver(invoiceInputSchema),
    defaultValues: props.defaults,
  });
  return (
    <Form {...form}>
      <InvoiceEditorForm {...props} />
    </Form>
  );
}

function InvoiceEditorForm({
  initialClient,
  settings,
  catalog,
  siteTypes,
  existing,
  deductions = [],
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    getValues,
    handleSubmit,
    setError: setFieldError,
    formState,
  } = useFormContext<InvoiceInput, unknown, InvoiceData>();
  const { client, pickClient, changeLanguage } = useClientAndLanguage(settings, initialClient);
  const values = useWatch({ control }) as InvoiceInput;

  // Mêmes calculs que le serveur : toutes les lignes sont dues (abonnements compris).
  const preview = previewInvoiceTotalsInput(values);
  const totals = useMemo(
    () => computeTotals({ ...previewInvoiceTotalsInput(values), vatEnabled: settings.vatEnabled }),
    [values, settings.vatEnabled],
  );

  async function onSubmit() {
    setError(null);
    const invoice = getValues();
    const result = existing
      ? await updateInvoiceAction({ id: existing.id, version: existing.version, invoice })
      : await createInvoiceAction({ invoice });
    if (!result.ok) {
      setError(result.error);
      applyServerFieldErrors(setFieldError, result.fieldErrors, "invoice.");
      return;
    }
    toast.success("Brouillon de facture enregistré.");
    router.push(`/factures/${result.data.id}`);
    router.refresh();
  }

  const submitLabel = formState.isSubmitting
    ? "Enregistrement…"
    : existing
      ? "Enregistrer"
      : "Créer le brouillon";
  const cancelHref = existing ? `/factures/${existing.id}` : "/factures";

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
          issueDateLabel="Date de la facture"
          secondDate={{
            name: "dueDate",
            label: "Échéance",
            offsetDays: settings.paymentTermDays,
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
              deposit={null}
              vatEnabled={settings.vatEnabled}
              deductions={deductions}
            />
            <DocumentDiscountField
              valueName="globalDiscountValue"
              typeName="globalDiscountType"
              label="Remise globale"
              help="S'ajoute aux remises de ligne."
            />
            <p className="text-muted-foreground text-xs">
              La facture reçoit son numéro à l&apos;émission ; d&apos;ici là, c&apos;est un
              brouillon modifiable.
            </p>
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
