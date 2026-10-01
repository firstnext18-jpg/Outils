import type { Metadata } from "next";
import { ReminderSettingsForm } from "@/app/(app)/parametres/relances/reminder-settings-form";
import { formatAmount } from "@/lib/format";
import { reminderTemplates } from "@/modules/settings/documents";
import { getSettings } from "@/modules/settings/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Relances" };

export default async function ReminderSettingsPage() {
  await requireRole("ADMIN");
  const s = await getSettings();
  const fee = (cents: number) => (cents > 0 ? formatAmount(cents) : "");
  return (
    <ReminderSettingsForm
      defaultValues={{
        reminderMode: s.reminderMode,
        reminderDelay1: String(s.reminderDelay1),
        reminderDelay2: String(s.reminderDelay2),
        reminderDelay3: String(s.reminderDelay3),
        reminderFee1Cents: fee(s.reminderFee1Cents),
        reminderFee2Cents: fee(s.reminderFee2Cents),
        reminderFee3Cents: fee(s.reminderFee3Cents),
        reminderPaymentDays: String(s.reminderPaymentDays),
        reminderTemplates: reminderTemplates(s),
        subscriptionAutoSend: s.subscriptionAutoSend,
      }}
    />
  );
}
