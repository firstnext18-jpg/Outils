import type { Metadata } from "next";
import { BellRingIcon } from "lucide-react";
import Link from "next/link";
import { ReminderActions } from "@/components/documents/reminder-actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { daysBetween, formatIsoDate, todayIso } from "@/domain/dates";
import { REMINDER_LEVEL_LABELS } from "@/domain/reminders";
import { canEdit } from "@/domain/roles";
import { formatChf } from "@/lib/format";
import { getInvoice } from "@/modules/invoices/service";
import { reminderEmailDraft, reminderProposals } from "@/modules/reminders/service";
import { getSettings } from "@/modules/settings/service";
import { reminderPdfFileName } from "@/server/pdf/reminder-pdf";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Relances à envoyer" };

export default async function RemindersPage() {
  const user = await requireUser();
  const today = todayIso();
  const [proposals, settings] = await Promise.all([reminderProposals(today), getSettings()]);
  const editable = canEdit(user.role);
  const rows = await Promise.all(
    proposals.map(async (proposal) => {
      if (!editable) return { proposal, email: null };
      const invoice = (await getInvoice(proposal.invoice.id))!;
      return {
        proposal,
        email: {
          draft: await reminderEmailDraft(invoice, settings),
          attachment: reminderPdfFileName(invoice, proposal.level, settings),
          senderEmail: user.email,
        },
      };
    }),
  );
  const automatic = settings.reminderMode === "AUTOMATIC";

  return (
    <>
      <PageHeader
        title="Relances à envoyer"
        description={
          automatic
            ? "Mode automatique : les relances partent chaque matin par email. Restent ici celles qui n'ont pas pu partir (client sans email, échec d'envoi)."
            : "Mode manuel : l'outil propose les relances dues, vous les validez une à une."
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={BellRingIcon}
          title="Aucune relance à envoyer"
          description="Les factures en retard apparaîtront ici dès que leur délai de relance sera atteint."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map(({ proposal, email }) => (
            <li key={proposal.invoice.id}>
              <Card className="py-4">
                <CardContent className="flex flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      <Link href={`/factures/${proposal.invoice.id}`} className="hover:underline">
                        Facture {proposal.invoice.number}
                      </Link>
                      {" · "}
                      {proposal.client.displayName}
                    </p>
                    <p className="text-muted-foreground">
                      {REMINDER_LEVEL_LABELS[proposal.level]} · échéance{" "}
                      {formatIsoDate(proposal.invoice.dueDate)} (
                      {daysBetween(proposal.invoice.dueDate, today)} jours de retard) · à payer{" "}
                      <span className="text-foreground font-medium tabular-nums">
                        {formatChf(proposal.totalCents)}
                      </span>
                      {proposal.feeCents > 0 && ` dont ${formatChf(proposal.feeCents)} de frais`}
                    </p>
                    {!proposal.client.email && (
                      <p className="text-warning text-xs">
                        Pas d&apos;adresse email sur la fiche du client : envoi par courrier, ou
                        ajoutez l&apos;adresse.
                      </p>
                    )}
                  </div>
                  {email && (
                    <ReminderActions
                      invoiceId={proposal.invoice.id}
                      level={proposal.level}
                      email={email}
                      size="sm"
                    />
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
