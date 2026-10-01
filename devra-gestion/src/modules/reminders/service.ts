import "server-only";
import {
  addDays,
  dbDateToIso,
  formatIsoDate,
  isoToDbDate,
  todayIso,
  type IsoDate,
} from "@/domain/dates";
import { renderTemplate, type EmailValues } from "@/domain/email-template";
import { isOpen } from "@/domain/invoice-status";
import {
  isReminderDue,
  nextReminder,
  REMINDER_LEVEL_LABELS,
  reminderAmounts,
  type ReminderLevel,
} from "@/domain/reminders";
import { formatChf } from "@/lib/format";
import { deliver } from "@/modules/emails/service";
import type { SendEmailData } from "@/modules/emails/schemas";
import { getInvoice, type InvoiceDetail } from "@/modules/invoices/service";
import {
  clientSnapshot,
  reminderRules,
  reminderTemplates,
  type ClientSnapshot,
} from "@/modules/settings/documents";
import { getSettings, type AppSettings } from "@/modules/settings/service";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import { buildReminderPdf } from "@/server/pdf/reminder-pdf";
import type { CurrentUser } from "@/server/session";
import { saveDocumentPdf } from "@/server/storage";

// ---------------------------------------------------------------------------
// Relances à envoyer
// ---------------------------------------------------------------------------

function storedReminders(reminders: { level: number; date: Date }[]) {
  return reminders.map((r) => ({ level: r.level, date: dbDateToIso(r.date) }));
}

/** Prochaine relance d'une facture (affichée sur sa fiche), et si elle est déjà due. */
export function invoiceNextReminder(
  invoice: InvoiceDetail,
  settings: AppSettings,
  today = todayIso(),
) {
  const next = nextReminder(
    { ...invoice, dueDate: dbDateToIso(invoice.dueDate) },
    storedReminders(invoice.reminders),
    reminderRules(settings),
  );
  return next ? { ...next, due: isReminderDue(next, today) } : null;
}

/** Factures dont une relance est due aujourd'hui (liste « Relances à envoyer », mode automatique). */
export async function reminderProposals(today = todayIso()) {
  const settings = await getSettings();
  const rules = reminderRules(settings);
  const invoices = await db.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: isoToDbDate(today) } },
    orderBy: [{ dueDate: "asc" }, { sequence: "asc" }],
    select: {
      id: true,
      number: true,
      status: true,
      dueDate: true,
      amountDueCents: true,
      feesCents: true,
      paidCents: true,
      client: { select: { id: true, displayName: true, email: true } },
      reminders: { select: { level: true, date: true } },
    },
  });
  return invoices.flatMap((invoice) => {
    const dueDate = dbDateToIso(invoice.dueDate);
    const next = nextReminder({ ...invoice, dueDate }, storedReminders(invoice.reminders), rules);
    if (!next || !isReminderDue(next, today)) return [];
    return [
      {
        invoice: { id: invoice.id, number: invoice.number!, dueDate },
        client: invoice.client,
        level: next.level,
        dueOn: next.dueOn,
        ...reminderAmounts(invoice, next.level, rules),
      },
    ];
  });
}

export type ReminderProposal = Awaited<ReturnType<typeof reminderProposals>>[number];

// ---------------------------------------------------------------------------
// Préparation : montants, texte, PDF
// ---------------------------------------------------------------------------

function clientName(client: Pick<ClientSnapshot, "displayName" | "kind" | "contactName">) {
  return (client.kind === "COMPANY" && client.contactName.trim()) || client.displayName;
}

type Prepared = {
  invoice: InvoiceDetail;
  level: ReminderLevel;
  date: IsoDate;
  dueDate: IsoDate;
  balanceCents: number;
  feeCents: number;
  totalCents: number;
  values: EmailValues;
  template: { subject: string; text: string };
};

async function prepare(
  invoiceId: string,
  settings: AppSettings,
  today: IsoDate,
): Promise<Prepared> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new UserError("Cette facture n'existe plus.");
  if (!isOpen(invoice.status) || !invoice.number) {
    throw new UserError("Seule une facture émise et pas encore payée peut être relancée.");
  }
  if (dbDateToIso(invoice.dueDate) >= today) {
    throw new UserError("Cette facture n'est pas encore échue : elle ne peut pas être relancée.");
  }
  const rules = reminderRules(settings);
  const next = nextReminder(
    { ...invoice, dueDate: dbDateToIso(invoice.dueDate) },
    storedReminders(invoice.reminders),
    rules,
  );
  if (!next) throw new UserError("Cette facture a déjà reçu les trois relances.");
  const amounts = reminderAmounts(invoice, next.level, rules);
  const dueDate = addDays(today, rules.paymentDays);
  const client =
    (invoice.clientSnapshot as ClientSnapshot | null) ?? clientSnapshot(invoice.client);
  return {
    invoice,
    level: next.level,
    date: today,
    dueDate,
    ...amounts,
    values: {
      client: clientName(client),
      numero: invoice.number,
      date: formatIsoDate(dbDateToIso(invoice.issueDate)),
      montant: formatChf(amounts.totalCents),
      echeance: formatIsoDate(dueDate),
      lien: "",
      entreprise: settings.companyName.trim(),
    },
    template: reminderTemplates(settings)[`level${next.level}`][invoice.language],
  };
}

/** Valeurs proposées dans la fenêtre d'envoi d'une relance. */
export async function reminderEmailDraft(invoice: InvoiceDetail, settings: AppSettings) {
  const prepared = await prepare(invoice.id, settings, todayIso());
  return {
    level: prepared.level,
    totalCents: prepared.totalCents,
    feeCents: prepared.feeCents,
    to: invoice.client.email,
    subject: renderTemplate(prepared.template.subject, prepared.values),
    body: renderTemplate(prepared.template.text, prepared.values),
  };
}

/**
 * Enregistre la relance (avec son PDF archivé) et ajoute ses frais au solde
 * de la facture. Le niveau est revérifié dans la transaction : deux relances
 * simultanées ne peuvent pas créer deux fois le même niveau.
 */
async function persist(
  actor: CurrentUser | null,
  prepared: Prepared,
  channel: "EMAIL" | "MANUAL",
  pdf: Buffer,
  text: string,
) {
  const reminder = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "invoice" WHERE id = ${prepared.invoice.id} FOR UPDATE`;
    const current = await tx.invoice.findUnique({
      where: { id: prepared.invoice.id },
      select: { status: true, reminders: { select: { level: true } } },
    });
    const lastLevel = Math.max(0, ...(current?.reminders.map((r) => r.level) ?? []));
    if (!current || !isOpen(current.status) || lastLevel !== prepared.level - 1) {
      throw new UserError("Cette facture vient de changer. Rechargez la page.");
    }
    const created = await tx.reminder.create({
      data: {
        invoiceId: prepared.invoice.id,
        level: prepared.level,
        date: isoToDbDate(prepared.date),
        dueDate: isoToDbDate(prepared.dueDate),
        balanceCents: prepared.balanceCents,
        feeCents: prepared.feeCents,
        totalCents: prepared.totalCents,
        channel,
        text,
        createdById: actor?.id ?? null,
      },
    });
    await tx.invoice.update({
      where: { id: prepared.invoice.id },
      data: { feesCents: { increment: prepared.feeCents }, version: { increment: 1 } },
    });
    await logActivity(
      {
        userId: actor?.id ?? null,
        action: "invoice.reminded",
        entityType: "invoice",
        entityId: prepared.invoice.id,
        label: prepared.invoice.number ?? "",
        details: {
          level: prepared.level,
          label: REMINDER_LEVEL_LABELS[prepared.level],
          channel,
          amount: formatChf(prepared.totalCents),
        },
      },
      tx,
    );
    return created;
  });
  const file = await saveDocumentPdf("reminders", reminder.id, pdf).catch(() => null);
  if (file) await db.reminder.update({ where: { id: reminder.id }, data: { pdfFile: file } });
  return reminder;
}

// ---------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------

/** Relance envoyée autrement (courrier) : enregistrée, avec son PDF à imprimer. */
export async function recordReminderWithoutEmail(actor: CurrentUser, invoiceId: string) {
  const settings = await getSettings();
  const prepared = await prepare(invoiceId, settings, todayIso());
  const text = renderTemplate(prepared.template.text, prepared.values);
  const { buffer } = await buildReminderPdf({ ...prepared, text }, settings);
  const reminder = await persist(actor, prepared, "MANUAL", buffer, text);
  return { id: reminder.id, level: prepared.level, number: prepared.invoice.number };
}

/**
 * Relance par email (message éventuellement modifié par l'utilisateur, qui
 * sert aussi de lettre sur le PDF). Elle n'est enregistrée que si l'envoi réussit.
 */
export async function sendReminderEmail(actor: CurrentUser | null, data: SendEmailData) {
  const settings = await getSettings();
  const prepared = await prepare(data.id, settings, todayIso());
  const subject = renderTemplate(data.subject, prepared.values);
  const text = renderTemplate(data.body, prepared.values);
  const attachment = await buildReminderPdf({ ...prepared, text }, settings);

  const result = await deliver({
    actor,
    data,
    settings,
    companyName: settings.companyName.trim(),
    subject,
    body: text,
    attachment,
    link: { invoiceId: prepared.invoice.id },
  });
  if (!result.ok) throw new UserError(`L'email n'a pas pu être envoyé : ${result.error}`);
  const reminder = await persist(actor, prepared, "EMAIL", attachment.buffer, text);
  await db.emailLog.update({ where: { id: result.logId }, data: { reminderId: reminder.id } });
  return { id: reminder.id, level: prepared.level, number: prepared.invoice.number };
}

/**
 * Mode automatique (tâche quotidienne) : envoie les relances dues aux clients
 * qui ont une adresse email ; les autres restent dans « Relances à envoyer ».
 */
export async function sendDueReminders(today = todayIso()) {
  const settings = await getSettings();
  const proposals = await reminderProposals(today);
  const result = { sent: 0, failed: 0, withoutEmail: 0 };
  for (const proposal of proposals) {
    if (!proposal.client.email) {
      result.withoutEmail += 1;
      continue;
    }
    const invoice = await getInvoice(proposal.invoice.id);
    if (!invoice) continue;
    const template = reminderTemplates(settings)[`level${proposal.level}`][invoice.language];
    try {
      await sendReminderEmail(null, {
        kind: "reminder",
        id: invoice.id,
        to: [proposal.client.email],
        subject: template.subject,
        body: template.text,
        copyToSender: false,
      });
      result.sent += 1;
    } catch (error) {
      console.error(`Relance automatique de ${proposal.invoice.number} impossible`, error);
      result.failed += 1;
    }
  }
  return result;
}

export function reminderPdfOwner(id: string) {
  return db.reminder.findUnique({
    where: { id },
    select: { id: true, invoiceId: true, level: true },
  });
}
