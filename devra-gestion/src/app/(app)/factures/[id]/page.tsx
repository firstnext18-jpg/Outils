import type { Metadata } from "next";
import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceActions } from "@/app/(app)/factures/[id]/invoice-actions";
import { PaymentsCard } from "@/app/(app)/factures/[id]/payments-card";
import { EmailHistoryCard } from "@/components/documents/email-history-card";
import { InvoiceStatusBadge } from "@/components/documents/invoice-status-badge";
import { LinesTable } from "@/components/documents/lines-table";
import { TotalsSummary } from "@/components/documents/totals-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/domain/activity";
import { LANGUAGE_LABELS } from "@/domain/clients";
import { daysBetween, dbDateToIso, formatIsoDate, todayIso } from "@/domain/dates";
import { formatIban } from "@/domain/iban";
import { balanceCents, displayStatus, INVOICE_TYPE_LABELS } from "@/domain/invoice-status";
import type { Deduction } from "@/domain/invoices";
import { missingQrRequirements } from "@/domain/qr-bill";
import { formatReference } from "@/domain/qr-reference";
import { canEdit } from "@/domain/roles";
import { formatChf, formatDateTime } from "@/lib/format";
import { storedDocumentTotals } from "@/modules/documents/lines";
import { getInvoice, getInvoiceActivity } from "@/modules/invoices/service";
import { companySnapshot } from "@/modules/settings/documents";
import { getSettings } from "@/modules/settings/service";
import { db } from "@/server/db";
import { invoiceEmailDraft, listEmailLogs } from "@/modules/emails/service";
import { invoicePdfFileName } from "@/server/pdf/invoice-pdf";
import { requireUser } from "@/server/session";

function title(invoice: { type: keyof typeof INVOICE_TYPE_LABELS; number: string | null }) {
  const type = INVOICE_TYPE_LABELS[invoice.type];
  return invoice.number ? `${type} ${invoice.number}` : `${type} (brouillon)`;
}

export async function generateMetadata({ params }: PageProps<"/factures/[id]">): Promise<Metadata> {
  const invoice = await getInvoice((await params).id);
  return { title: invoice ? title(invoice) : "Facture" };
}

export default async function InvoicePage({ params }: PageProps<"/factures/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [invoice, activity, settings, emails] = await Promise.all([
    getInvoice(id),
    getInvoiceActivity(id),
    getSettings(),
    listEmailLogs({ invoiceId: id }),
  ]);
  if (!invoice) notFound();

  const today = todayIso();
  const dueDate = dbDateToIso(invoice.dueDate);
  const status = displayStatus(invoice.status, dueDate, today);
  const { totals, globalDiscount } = storedDocumentTotals(invoice, { separateRecurring: false });
  const deductions = (invoice.deductions as Deduction[] | null) ?? [];
  const balance = balanceCents(invoice.amountDueCents, invoice.paidCents);
  const editable = canEdit(user.role);

  // Avant l'émission : ce qui manque pour produire la QR-facture.
  const company = companySnapshot(settings);
  const issueBlockers =
    invoice.status === "DRAFT" && invoice.amountDueCents > 0
      ? missingQrRequirements({ ...company, iban: settings.iban, qrIban: settings.qrIban })
      : [];

  // Facture finale : acomptes déduits pas encore entièrement payés.
  const unpaidDeposits =
    deductions.length > 0
      ? await db.invoice.findMany({
          where: { id: { in: deductions.map((d) => d.invoiceId) }, status: { not: "PAID" } },
          select: { number: true },
        })
      : [];

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Link href="/factures" className="text-muted-foreground text-sm hover:underline">
            ← Factures
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{title(invoice)}</h1>
            <InvoiceStatusBadge status={status} />
          </div>
          <p className="text-muted-foreground">
            <Link
              href={`/clients/${invoice.client.id}`}
              className="text-foreground font-medium hover:underline"
            >
              {invoice.client.displayName}
            </Link>
            {invoice.subject && ` · ${invoice.subject}`}
          </p>
        </div>
        <InvoiceActions
          invoice={{
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
            version: invoice.version,
            paidCents: invoice.paidCents,
            balanceCents: balance,
          }}
          canEdit={editable}
          issueBlockers={issueBlockers}
          email={{
            draft: invoiceEmailDraft(invoice, settings),
            attachment: invoice.number
              ? invoicePdfFileName(invoice, settings)
              : "PDF de la facture (avec son numéro et sa QR-facture)",
            note:
              invoice.status === "DRAFT"
                ? "La facture sera d'abord émise : elle recevra son numéro définitif et sa QR-facture, puis ne pourra plus être modifiée."
                : undefined,
            senderEmail: user.email,
          }}
        />
      </div>

      {issueBlockers.length > 0 && (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>QR-facture impossible pour l&apos;instant</AlertTitle>
          <AlertDescription>
            Avant d&apos;émettre cette facture, un administrateur doit compléter{" "}
            {user.role === "ADMIN" ? (
              <Link href="/parametres/entreprise" className="underline">
                Paramètres → Entreprise
              </Link>
            ) : (
              "Paramètres → Entreprise"
            )}{" "}
            : {issueBlockers.join(", ")}.
          </AlertDescription>
        </Alert>
      )}
      {unpaidDeposits.length > 0 && invoice.status !== "CANCELLED" && (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Acompte pas encore entièrement payé</AlertTitle>
          <AlertDescription>
            Cette facture déduit {unpaidDeposits.map((d) => d.number).join(", ")}, qui n&apos;
            {unpaidDeposits.length > 1 ? "ont" : "a"} pas encore été entièrement payée
            {unpaidDeposits.length > 1 ? "s" : ""}.
          </AlertDescription>
        </Alert>
      )}
      {invoice.status === "CANCELLED" && (
        <Alert>
          <AlertTitle>
            Facture annulée
            {invoice.cancelledAt && ` le ${formatDateTime(invoice.cancelledAt)}`}
          </AlertTitle>
          <AlertDescription>Motif : {invoice.cancelReason}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lignes</CardTitle>
            </CardHeader>
            <CardContent>
              <LinesTable lines={invoice.lines} separateRecurring={false} />
            </CardContent>
          </Card>
          {invoice.status !== "DRAFT" && (
            <PaymentsCard
              invoiceId={invoice.id}
              canDelete={editable}
              payments={invoice.payments.map((payment) => ({
                id: payment.id,
                date: dbDateToIso(payment.date),
                amountCents: payment.amountCents,
                method: payment.method,
                note: payment.note,
                createdBy: payment.createdBy?.name ?? null,
              }))}
            />
          )}
          {(invoice.introText || invoice.conditionsText) && (
            <Card>
              <CardHeader>
                <CardTitle>Textes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {invoice.introText && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Introduction
                    </p>
                    <p className="whitespace-pre-wrap">{invoice.introText}</p>
                  </div>
                )}
                {invoice.conditionsText && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      Conditions
                    </p>
                    <p className="whitespace-pre-wrap">{invoice.conditionsText}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <EmailHistoryCard logs={emails} />
          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex flex-col sm:flex-row sm:gap-3">
                    <time className="text-muted-foreground shrink-0 tabular-nums sm:w-36">
                      {formatDateTime(entry.createdAt)}
                    </time>
                    <span>
                      <span className="font-medium">{entry.user?.name ?? "Système"}</span>{" "}
                      {describeActivity(entry.action, entry.details)}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Montants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TotalsSummary
                totals={totals}
                globalDiscount={globalDiscount}
                deposit={null}
                vatEnabled={invoice.vatEnabled}
                deductions={deductions}
              />
              {invoice.status !== "DRAFT" && invoice.status !== "CANCELLED" && (
                <dl className="bg-muted/60 space-y-1.5 rounded-md p-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt>Payé</dt>
                    <dd className="tabular-nums">{formatChf(invoice.paidCents)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 font-semibold">
                    <dt>Solde</dt>
                    <dd className="tabular-nums">{formatChf(balance)}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Type</dt>
                <dd>{INVOICE_TYPE_LABELS[invoice.type]}</dd>
                <dt className="text-muted-foreground">Date</dt>
                <dd>{formatIsoDate(dbDateToIso(invoice.issueDate))}</dd>
                <dt className="text-muted-foreground">Échéance</dt>
                <dd>
                  {formatIsoDate(dueDate)}
                  {status === "OVERDUE" && (
                    <span className="text-destructive block text-xs">
                      En retard de {daysBetween(dueDate, today)} jour
                      {daysBetween(dueDate, today) > 1 ? "s" : ""}
                    </span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Langue</dt>
                <dd>{LANGUAGE_LABELS[invoice.language]}</dd>
                {invoice.quote && (
                  <>
                    <dt className="text-muted-foreground">Devis</dt>
                    <dd>
                      <Link href={`/devis/${invoice.quote.id}`} className="hover:underline">
                        {invoice.quote.number}
                      </Link>
                    </dd>
                  </>
                )}
                {invoice.paymentReference && (
                  <>
                    <dt className="text-muted-foreground">Référence</dt>
                    <dd className="break-all tabular-nums">
                      {formatReference(invoice.paymentReference)}
                    </dd>
                  </>
                )}
                {invoice.paymentAccount && (
                  <>
                    <dt className="text-muted-foreground">Compte</dt>
                    <dd className="text-xs leading-5 whitespace-nowrap tabular-nums">
                      {formatIban(invoice.paymentAccount)}
                    </dd>
                  </>
                )}
                {invoice.issuedAt && (
                  <>
                    <dt className="text-muted-foreground">Émise le</dt>
                    <dd>{formatDateTime(invoice.issuedAt)}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Créée par</dt>
                <dd>{invoice.createdBy?.name ?? "—"}</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
