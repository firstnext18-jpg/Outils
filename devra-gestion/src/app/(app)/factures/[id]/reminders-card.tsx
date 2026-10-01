import { FileDownIcon } from "lucide-react";
import { ReminderActions } from "@/components/documents/reminder-actions";
import type { SendEmailProps } from "@/components/documents/send-email-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIsoDate } from "@/domain/dates";
import { REMINDER_LEVEL_LABELS, type ReminderLevel } from "@/domain/reminders";
import { formatChf } from "@/lib/format";

export type ReminderRow = {
  id: string;
  level: ReminderLevel;
  date: string;
  dueDate: string;
  totalCents: number;
  feeCents: number;
  channel: "EMAIL" | "MANUAL";
  createdBy: string | null;
};

/** Relances d'une facture : historique, et prochaine relance possible. */
export function RemindersCard({
  invoiceId,
  reminders,
  next,
  email,
}: {
  invoiceId: string;
  reminders: ReminderRow[];
  /** Prochaine relance ; `email` présent si elle peut être faite maintenant. */
  next: { level: ReminderLevel; dueOn: string; due: boolean } | null;
  email: Omit<SendEmailProps, "kind" | "documentId" | "version"> | null;
}) {
  if (reminders.length === 0 && !email) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {reminders.length > 0 && (
          <ul className="divide-y">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {REMINDER_LEVEL_LABELS[reminder.level]} du {formatIsoDate(reminder.date)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatChf(reminder.totalCents)} d&apos;ici au {formatIsoDate(reminder.dueDate)}
                    {reminder.feeCents > 0 && ` (frais ${formatChf(reminder.feeCents)})`}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {reminder.channel === "EMAIL" ? "Envoyée par email" : "Par courrier"}
                    {` · ${reminder.createdBy ?? "envoi automatique"}`}
                  </p>
                </div>
                <a
                  href={`/api/relances/${reminder.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <FileDownIcon className="size-4" /> PDF
                </a>
              </li>
            ))}
          </ul>
        )}
        {next && email && (
          <div className="space-y-2 rounded-md border p-3">
            <p>
              {next.due
                ? `${REMINDER_LEVEL_LABELS[next.level]} à envoyer (prévu depuis le ${formatIsoDate(next.dueOn)}).`
                : `Prochaine relance : ${REMINDER_LEVEL_LABELS[next.level].toLowerCase()}, prévue le ${formatIsoDate(next.dueOn)}. Vous pouvez l'envoyer dès maintenant.`}
            </p>
            <ReminderActions invoiceId={invoiceId} level={next.level} email={email} size="sm" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
