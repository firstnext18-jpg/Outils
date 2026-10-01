/**
 * Statuts d'une facture.
 *
 *   brouillon ──émission──► envoyée ──paiement──► partiellement payée ──► payée
 *                              │
 *                              └──► annulée (sans paiement enregistré)
 *
 * « En retard » n'est pas enregistré : c'est une envoyée ou partiellement
 * payée dont l'échéance est dépassée, calculé à l'affichage. Il reste donc
 * juste même si la tâche planifiée n'a pas tourné.
 */
import type { IsoDate } from "@/domain/dates";

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Statut affiché : le statut enregistré, ou « en retard ». */
export type InvoiceDisplayStatus = InvoiceStatus | "OVERDUE";

export const INVOICE_STATUS_LABELS: Record<InvoiceDisplayStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyée",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};

export const INVOICE_TYPES = ["STANDARD", "DEPOSIT", "FINAL", "SUBSCRIPTION"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  STANDARD: "Facture",
  DEPOSIT: "Facture d'acompte",
  FINAL: "Facture finale",
  SUBSCRIPTION: "Facture d'abonnement",
};

/** Une facture émise et pas encore entièrement payée. */
export function isOpen(status: InvoiceStatus): boolean {
  return status === "SENT" || status === "PARTIALLY_PAID";
}

export function isOverdue(status: InvoiceStatus, dueDate: IsoDate, today: IsoDate): boolean {
  return isOpen(status) && dueDate < today;
}

export function displayStatus(
  status: InvoiceStatus,
  dueDate: IsoDate,
  today: IsoDate,
): InvoiceDisplayStatus {
  return isOverdue(status, dueDate, today) ? "OVERDUE" : status;
}

/** Statut d'une facture émise d'après ce qui a été payé. */
export function statusAfterPayments(amountDueCents: number, paidCents: number): InvoiceStatus {
  if (paidCents >= amountDueCents) return "PAID";
  return paidCents > 0 ? "PARTIALLY_PAID" : "SENT";
}

/** Solde restant (jamais négatif). */
export function balanceCents(amountDueCents: number, paidCents: number): number {
  return Math.max(0, amountDueCents - paidCents);
}

/** Seule une facture émise sans paiement peut être annulée ; un brouillon se supprime. */
export function canCancel(status: InvoiceStatus, paidCents: number): boolean {
  return status === "SENT" && paidCents === 0;
}

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "TWINT", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Virement",
  CASH: "Espèces",
  TWINT: "TWINT",
  OTHER: "Autre",
};
