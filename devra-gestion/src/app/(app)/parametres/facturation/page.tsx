import type { Metadata } from "next";
import { BillingForm } from "@/app/(app)/parametres/facturation/billing-form";
import { formatPercentValue } from "@/domain/percent";
import { currentCounters } from "@/modules/settings/billing";
import { getSettings } from "@/modules/settings/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Facturation" };

export default async function BillingSettingsPage() {
  await requireRole("ADMIN");
  const [s, counters] = await Promise.all([getSettings(), currentCounters()]);
  return (
    <BillingForm
      counters={counters}
      defaultValues={{
        quoteNumberFormat: s.quoteNumberFormat,
        invoiceNumberFormat: s.invoiceNumberFormat,
        nextQuoteNumber: "",
        nextInvoiceNumber: "",
        quoteValidityDays: String(s.quoteValidityDays),
        paymentTermDays: String(s.paymentTermDays),
        vatEnabled: s.vatEnabled,
        vatNumber: s.vatNumber,
        vatRates: s.vatRates.map(formatPercentValue),
      }}
    />
  );
}
