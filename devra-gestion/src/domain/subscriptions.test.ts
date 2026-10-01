import { describe, expect, it } from "vitest";
import { outstandingCents } from "@/domain/invoice-status";
import {
  nextReminder,
  reminderAmounts,
  isReminderDue,
  DEFAULT_REMINDER_RULES,
  type ReminderRules,
} from "@/domain/reminders";
import { addMonths } from "@/domain/dates";
import {
  duePeriods,
  indexAfterPause,
  periodEnd,
  periodStart,
  recurringRevenue,
} from "@/domain/subscriptions";

describe("périodes d'abonnement", () => {
  it("ajoute des mois en restant dans le mois visé", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-12-01", 12)).toBe("2027-12-01");
  });

  it("ancre les périodes sur la date de début (31.01 → 28.02 → 31.03)", () => {
    expect(periodStart("2026-01-31", "MONTHLY", 1)).toBe("2026-02-28");
    expect(periodStart("2026-01-31", "MONTHLY", 2)).toBe("2026-03-31");
    expect(periodEnd("2026-01-31", "MONTHLY", 0)).toBe("2026-02-27");
    expect(periodEnd("2026-10-01", "QUARTERLY", 0)).toBe("2026-12-31");
    expect(periodEnd("2026-10-01", "YEARLY", 0)).toBe("2027-09-30");
  });

  it("facture la période qui commence aujourd'hui, pas celle de demain", () => {
    const sub = { startDate: "2026-10-01", periodicity: "MONTHLY" as const, billedPeriods: 0 };
    expect(duePeriods(sub, "2026-09-30")).toEqual([]);
    expect(duePeriods(sub, "2026-10-01")).toEqual([
      { index: 0, start: "2026-10-01", end: "2026-10-31" },
    ]);
  });

  it("rattrape les périodes manquées, sans refacturer celles déjà faites", () => {
    const sub = { startDate: "2026-07-01", periodicity: "MONTHLY" as const, billedPeriods: 1 };
    expect(duePeriods(sub, "2026-10-05").map((p) => p.start)).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
    expect(duePeriods({ ...sub, billedPeriods: 4 }, "2026-10-05")).toEqual([]);
  });

  it("plafonne le rattrapage", () => {
    const sub = { startDate: "2020-01-01", periodicity: "MONTHLY" as const, billedPeriods: 0 };
    expect(duePeriods(sub, "2026-10-01")).toHaveLength(12);
  });

  it("ne facture pas les périodes écoulées pendant une pause", () => {
    const sub = { startDate: "2026-01-15", periodicity: "MONTHLY" as const, billedPeriods: 3 };
    // Pause du 15.04 au 20.07 : reprise à la période du 15.08.
    expect(indexAfterPause(sub, "2026-07-20")).toBe(7);
    expect(periodStart(sub.startDate, "MONTHLY", 7)).toBe("2026-08-15");
    // Reprise le jour même d'un début de période : celle-ci est facturée.
    expect(indexAfterPause(sub, "2026-08-15")).toBe(7);
  });
});

describe("revenu récurrent", () => {
  it("additionne les abonnements actifs, ramenés au mois et à l'année", () => {
    const revenue = recurringRevenue([
      { status: "ACTIVE", periodicity: "MONTHLY", amountCents: 2_900 },
      { status: "ACTIVE", periodicity: "QUARTERLY", amountCents: 9_000 },
      { status: "ACTIVE", periodicity: "YEARLY", amountCents: 29_000 },
      { status: "PAUSED", periodicity: "MONTHLY", amountCents: 10_000 },
      { status: "CANCELLED", periodicity: "YEARLY", amountCents: 50_000 },
    ]);
    // 29.00 + 90.00 / 3 + 290.00 / 12 = 29.00 + 30.00 + 24.1666… = 83.17
    expect(revenue.mrrCents).toBe(8_317);
    // 29.00 × 12 + 90.00 × 4 + 290.00 = 998.00
    expect(revenue.arrCents).toBe(99_800);
  });
});

describe("relances", () => {
  const rules: ReminderRules = {
    delays: { 1: 10, 2: 15, 3: 15 },
    feesCents: { 1: 0, 2: 2_000, 3: 3_000 },
    paymentDays: 10,
  };
  const invoice = {
    status: "SENT" as const,
    dueDate: "2026-09-15",
    amountDueCents: 100_000,
    feesCents: 0,
    paidCents: 0,
  };

  it("propose le 1er rappel X jours après l'échéance", () => {
    const next = nextReminder(invoice, [], rules);
    expect(next).toEqual({ level: 1, dueOn: "2026-09-25" });
    expect(isReminderDue(next, "2026-09-24")).toBe(false);
    expect(isReminderDue(next, "2026-09-25")).toBe(true);
  });

  it("enchaîne les niveaux à partir de la relance précédente, puis s'arrête", () => {
    expect(nextReminder(invoice, [{ level: 1, date: "2026-09-26" }], rules)).toEqual({
      level: 2,
      dueOn: "2026-10-11",
    });
    expect(
      nextReminder(
        invoice,
        [
          { level: 1, date: "2026-09-26" },
          { level: 2, date: "2026-10-12" },
        ],
        rules,
      ),
    ).toEqual({ level: 3, dueOn: "2026-10-27" });
    expect(nextReminder(invoice, [{ level: 3, date: "2026-10-28" }], rules)).toBeNull();
  });

  it("ne relance pas une facture payée, annulée ou en brouillon", () => {
    expect(nextReminder({ ...invoice, status: "PAID", paidCents: 100_000 }, [], rules)).toBeNull();
    expect(nextReminder({ ...invoice, status: "CANCELLED" }, [], rules)).toBeNull();
    expect(nextReminder({ ...invoice, status: "DRAFT" }, [], rules)).toBeNull();
  });

  it("relance le solde d'une facture partiellement payée, frais compris", () => {
    const partial = { ...invoice, status: "PARTIALLY_PAID" as const, paidCents: 40_000 };
    expect(reminderAmounts(partial, 1, rules)).toEqual({
      balanceCents: 60_000,
      feeCents: 0,
      totalCents: 60_000,
    });
    // Au 2e rappel, les frais s'ajoutent ; ceux d'une relance précédente sont déjà dans le solde.
    const withFees = { ...partial, feesCents: 1_500 };
    expect(outstandingCents(withFees)).toBe(61_500);
    expect(reminderAmounts(withFees, 2, rules)).toEqual({
      balanceCents: 61_500,
      feeCents: 2_000,
      totalCents: 63_500,
    });
  });

  it("utilise par défaut les délais validés (10, 15 et 15 jours, sans frais)", () => {
    expect(DEFAULT_REMINDER_RULES.delays).toEqual({ 1: 10, 2: 15, 3: 15 });
    expect(DEFAULT_REMINDER_RULES.feesCents).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});
