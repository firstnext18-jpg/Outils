/**
 * Argent des associés : apports en capital, prêts à l'entreprise, et ce que
 * l'entreprise leur rend. Module pur : utilisable côté serveur comme côté client.
 */

export const PARTNER_KINDS = ["CAPITAL_IN", "LOAN_IN", "LOAN_OUT", "CAPITAL_OUT"] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  CAPITAL_IN: "Apport en capital",
  LOAN_IN: "Prêt d'associé",
  LOAN_OUT: "Remboursement du prêt",
  CAPITAL_OUT: "Retrait de capital",
};

export const PARTNER_KIND_HELP: Record<PartnerKind, string> = {
  CAPITAL_IN: "L'associé investit de l'argent dans l'entreprise, définitivement.",
  LOAN_IN: "L'associé prête de l'argent à l'entreprise, qui devra le lui rendre.",
  LOAN_OUT: "L'entreprise rend à l'associé tout ou partie de son prêt.",
  CAPITAL_OUT: "L'entreprise rend à l'associé de l'argent qu'il avait apporté.",
};

/** L'argent entre-t-il dans l'entreprise (apport, prêt) ou en sort-il (remboursement, retrait) ? */
export function isIncoming(kind: PartnerKind): boolean {
  return kind === "CAPITAL_IN" || kind === "LOAN_IN";
}

/** Montant avec son signe, du point de vue de l'entreprise (+ entre, − sort). */
export function signedCents(movement: { kind: PartnerKind; amountCents: number }): number {
  return isIncoming(movement.kind) ? movement.amountCents : -movement.amountCents;
}

export type PartnerBalance = {
  /** Capital apporté, moins les retraits. */
  capitalCents: number;
  /** Prêt encore dû par l'entreprise à l'associé. */
  loanCents: number;
  /** Total entré (apports + prêts). */
  inCents: number;
  /** Total rendu (remboursements + retraits). */
  outCents: number;
};

export function emptyBalance(): PartnerBalance {
  return { capitalCents: 0, loanCents: 0, inCents: 0, outCents: 0 };
}

/** Solde d'un associé (ou de tous) à partir de ses mouvements. */
export function partnerBalance(
  movements: { kind: PartnerKind; amountCents: number }[],
): PartnerBalance {
  const balance = emptyBalance();
  for (const { kind, amountCents } of movements) {
    if (kind === "CAPITAL_IN") balance.capitalCents += amountCents;
    if (kind === "CAPITAL_OUT") balance.capitalCents -= amountCents;
    if (kind === "LOAN_IN") balance.loanCents += amountCents;
    if (kind === "LOAN_OUT") balance.loanCents -= amountCents;
    if (isIncoming(kind)) balance.inCents += amountCents;
    else balance.outCents += amountCents;
  }
  return balance;
}

/**
 * Un remboursement ou un retrait ne peut pas dépasser ce que l'associé a mis
 * (prêt restant, capital apporté). Renvoie le message à afficher, ou `null`.
 */
export function overdrawProblem(
  movement: { kind: PartnerKind; amountCents: number },
  balance: PartnerBalance,
  formatChf: (cents: number) => string,
): string | null {
  if (movement.kind === "LOAN_OUT" && movement.amountCents > balance.loanCents) {
    return balance.loanCents > 0
      ? `Le remboursement dépasse le prêt restant de cet associé (${formatChf(balance.loanCents)}).`
      : "Cet associé n'a pas de prêt en cours à rembourser.";
  }
  if (movement.kind === "CAPITAL_OUT" && movement.amountCents > balance.capitalCents) {
    return balance.capitalCents > 0
      ? `Le retrait dépasse le capital apporté par cet associé (${formatChf(balance.capitalCents)}).`
      : "Cet associé n'a pas de capital apporté à retirer.";
  }
  return null;
}
