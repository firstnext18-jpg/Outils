import type { Metadata } from "next";
import { EmailTemplatesForm } from "@/app/(app)/parametres/emails/email-templates-form";
import { getSettings } from "@/modules/settings/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Emails" };

export default async function EmailSettingsPage() {
  await requireRole("ADMIN");
  const s = await getSettings();
  return (
    <EmailTemplatesForm
      defaultValues={{
        quoteEmailSubjectFr: s.quoteEmailSubjectFr,
        quoteEmailSubjectDe: s.quoteEmailSubjectDe,
        quoteEmailBodyFr: s.quoteEmailBodyFr,
        quoteEmailBodyDe: s.quoteEmailBodyDe,
        invoiceEmailSubjectFr: s.invoiceEmailSubjectFr,
        invoiceEmailSubjectDe: s.invoiceEmailSubjectDe,
        invoiceEmailBodyFr: s.invoiceEmailBodyFr,
        invoiceEmailBodyDe: s.invoiceEmailBodyDe,
      }}
    />
  );
}
