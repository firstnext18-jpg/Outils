import "server-only";
import { CamtError, matchCredit, parseCamt, type BankCredit, type Match } from "@/domain/camt";
import { isoToDbDate, todayIso } from "@/domain/dates";
import { outstandingCents } from "@/domain/invoice-status";
import { formatChf } from "@/lib/format";
import { recordPayment } from "@/modules/invoices/service";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

/**
 * Import des paiements depuis un relevé bancaire camt : lecture, propositions
 * de rapprochement (aperçu, rien n'est enregistré), puis enregistrement des
 * paiements confirmés. Une opération déjà importée ne l'est jamais deux fois.
 */

export type OpenInvoiceOption = {
  id: string;
  number: string;
  client: string;
  outstandingCents: number;
  paymentReference: string;
};

/** Factures émises qui attendent encore un paiement. */
export async function openInvoiceOptions(): Promise<OpenInvoiceOption[]> {
  const invoices = await db.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIALLY_PAID"] }, number: { not: null } },
    orderBy: [{ issueDate: "asc" }, { sequence: "asc" }],
    select: {
      id: true,
      number: true,
      paymentReference: true,
      amountDueCents: true,
      feesCents: true,
      paidCents: true,
      client: { select: { displayName: true } },
    },
  });
  return invoices.map((i) => ({
    id: i.id,
    number: i.number ?? "",
    client: i.client.displayName,
    outstandingCents: outstandingCents(i),
    paymentReference: i.paymentReference,
  }));
}

export type PreviewRow = BankCredit & { match: Match; alreadyImported: boolean };

/** Lit le fichier et propose une facture pour chaque crédit. */
export async function previewBankFile(xml: string) {
  let credits: BankCredit[];
  try {
    credits = parseCamt(xml);
  } catch (error) {
    if (error instanceof CamtError) throw new UserError(error.message);
    throw error;
  }
  const [invoices, imported] = await Promise.all([
    openInvoiceOptions(),
    db.bankTransaction.findMany({
      where: { key: { in: credits.map((c) => c.key) } },
      select: { key: true },
    }),
  ]);
  const importedKeys = new Set(imported.map((t) => t.key));
  const rows: PreviewRow[] = credits.map((credit) => ({
    ...credit,
    alreadyImported: importedKeys.has(credit.key),
    match: importedKeys.has(credit.key)
      ? { invoiceId: null, how: null }
      : matchCredit(credit, invoices),
  }));
  return { rows, invoices };
}

export type ConfirmedRow = BankCredit & { invoiceId: string };

/**
 * Enregistre un paiement par opération confirmée (au plus le solde de la
 * facture : un trop-perçu est signalé). Chaque paiement est indépendant :
 * une erreur sur l'un n'empêche pas les autres.
 */
export async function importBankPayments(
  actor: CurrentUser,
  fileName: string,
  rows: ConfirmedRow[],
) {
  const results: { key: string; ok: boolean; message: string }[] = [];
  const bankImport = await db.bankImport.create({
    data: {
      fileName: fileName.slice(0, 200),
      credits: rows.length,
      paymentCount: 0,
      createdById: actor.id,
    },
  });
  let paymentCount = 0;
  for (const row of rows) {
    try {
      if (await db.bankTransaction.findUnique({ where: { key: row.key }, select: { id: true } })) {
        results.push({ key: row.key, ok: false, message: "déjà importée" });
        continue;
      }
      const invoice = await db.invoice.findUnique({
        where: { id: row.invoiceId },
        select: {
          number: true,
          amountDueCents: true,
          feesCents: true,
          paidCents: true,
          status: true,
        },
      });
      if (!invoice) throw new UserError("facture introuvable");
      const balance = outstandingCents(invoice);
      const amountCents = Math.min(row.amountCents, balance);
      if (amountCents <= 0) throw new UserError(`la facture ${invoice.number} est déjà payée`);
      const date = row.bookingDate > todayIso() ? todayIso() : row.bookingDate;
      await recordPayment(
        actor,
        {
          invoiceId: row.invoiceId,
          date,
          amountCents,
          method: "BANK_TRANSFER",
          note: ["Import bancaire", row.debtorName, row.reference || row.remittance]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 500),
        },
        async (tx, paymentId) => {
          await tx.bankTransaction.create({
            data: {
              importId: bankImport.id,
              key: row.key,
              bookingDate: isoToDbDate(row.bookingDate),
              amountCents: row.amountCents,
              creditorReference: row.reference,
              debtorName: row.debtorName,
              remittance: row.remittance,
              paymentId,
            },
          });
        },
      );
      paymentCount += 1;
      results.push({
        key: row.key,
        ok: true,
        message:
          row.amountCents > amountCents
            ? `${invoice.number} : ${formatChf(amountCents)} enregistrés, trop-perçu de ${formatChf(row.amountCents - amountCents)} à traiter`
            : `${invoice.number} : ${formatChf(amountCents)} enregistrés`,
      });
    } catch (error) {
      results.push({
        key: row.key,
        ok: false,
        message: error instanceof UserError ? error.message : "erreur inattendue",
      });
      if (!(error instanceof UserError)) console.error("Import bancaire", error);
    }
  }
  await db.bankImport.update({ where: { id: bankImport.id }, data: { paymentCount } });
  return { paymentCount, results };
}

/** Derniers imports (page d'import). */
export function lastBankImports(take = 5) {
  return db.bankImport.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      fileName: true,
      credits: true,
      paymentCount: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
}
