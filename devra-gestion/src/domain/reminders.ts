/**
 * Relances des factures impayées, en 3 niveaux :
 *   1. rappel        : X jours après l'échéance de la facture ;
 *   2. 2e rappel     : Y jours après le 1er rappel ;
 *   3. mise en demeure : Z jours après le 2e rappel.
 * Chaque relance fixe un nouveau délai de paiement et peut ajouter des frais.
 */
import { addDays, type IsoDate } from "@/domain/dates";
import { isOpen, outstandingCents, type InvoiceStatus } from "@/domain/invoice-status";

export const REMINDER_LEVELS = [1, 2, 3] as const;
export type ReminderLevel = (typeof REMINDER_LEVELS)[number];

export const REMINDER_LEVEL_LABELS: Record<ReminderLevel, string> = {
  1: "1er rappel",
  2: "2e rappel",
  3: "Mise en demeure",
};

export type ReminderRules = {
  /** Délais en jours : après l'échéance (niveau 1), puis après la relance précédente. */
  delays: Record<ReminderLevel, number>;
  /** Frais ajoutés par chaque niveau, en centimes. */
  feesCents: Record<ReminderLevel, number>;
  /** Nouveau délai de paiement accordé par une relance, en jours. */
  paymentDays: number;
};

export const DEFAULT_REMINDER_RULES: ReminderRules = {
  delays: { 1: 10, 2: 15, 3: 15 },
  feesCents: { 1: 0, 2: 0, 3: 0 },
  paymentDays: 10,
};

/**
 * Prochaine relance d'une facture : son niveau et la date à partir de laquelle
 * elle est due. Null si la facture n'est plus ouverte ou a déjà reçu les 3 relances.
 */
export function nextReminder(
  invoice: {
    status: InvoiceStatus;
    dueDate: IsoDate;
    amountDueCents: number;
    feesCents: number;
    paidCents: number;
  },
  reminders: { level: number; date: IsoDate }[],
  rules: ReminderRules,
): { level: ReminderLevel; dueOn: IsoDate } | null {
  if (!isOpen(invoice.status) || outstandingCents(invoice) <= 0) return null;
  const last = reminders.reduce<{ level: number; date: IsoDate } | null>(
    (latest, r) => (!latest || r.level > latest.level ? r : latest),
    null,
  );
  if (!last) return { level: 1, dueOn: addDays(invoice.dueDate, rules.delays[1]) };
  if (last.level >= 3) return null;
  const level = (last.level + 1) as ReminderLevel;
  return { level, dueOn: addDays(last.date, rules.delays[level]) };
}

export function isReminderDue(next: { dueOn: IsoDate } | null, today: IsoDate): boolean {
  return next !== null && next.dueOn <= today;
}

/** Montants d'une nouvelle relance : solde actuel, frais de ce niveau, total à payer. */
export function reminderAmounts(
  invoice: { amountDueCents: number; feesCents: number; paidCents: number },
  level: ReminderLevel,
  rules: ReminderRules,
) {
  const balanceCents = outstandingCents(invoice);
  const feeCents = rules.feesCents[level];
  return { balanceCents, feeCents, totalCents: balanceCents + feeCents };
}
