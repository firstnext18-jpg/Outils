import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { todayIso } from "@/domain/dates";
import { sendDueQuoteReminders } from "@/modules/emails/service";
import { expireQuotes } from "@/modules/quotes/service";
import { reminderProposals, sendDueReminders } from "@/modules/reminders/service";
import { getSettings } from "@/modules/settings/service";
import { billDueSubscriptions } from "@/modules/subscriptions/service";
import { UserError } from "@/server/action";
import { db } from "@/server/db";

/** Compte rendu d'une exécution des tâches quotidiennes. */
export type DailySummary = {
  date: string;
  expiredQuotes?: number;
  subscriptionInvoices?: number;
  subscriptionEmails?: { sent: number; failed: number };
  reminders?:
    | { mode: "MANUAL"; toSend: number }
    | { mode: "AUTOMATIC"; sent: number; failed: number; withoutEmail: number };
  quoteReminders?: { sent: number; failed: number; skipped: boolean };
};

/** Une exécution qui ne s'est pas terminée depuis plus longtemps est considérée comme interrompue. */
const STALE_RUN_MS = 30 * 60_000;

/**
 * Tâches quotidiennes, appelées chaque matin par le conteneur « cron » (ou à
 * la main par un admin) : devis expirés, factures d'abonnement, relances.
 * Chaque tâche est indépendante : l'échec de l'une n'empêche pas les autres.
 */
export async function runDailyTasks(trigger: "cron" | "manual", userId: string | null = null) {
  const running = await db.taskRun.findFirst({
    where: { finishedAt: null, startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) } },
  });
  if (running) throw new UserError("Les tâches sont déjà en cours d'exécution.");
  const run = await db.taskRun.create({ data: { trigger, userId } });

  const today = todayIso();
  const summary: DailySummary = { date: today };
  const errors: string[] = [];
  async function step(name: string, task: () => Promise<void>) {
    try {
      await task();
    } catch (error) {
      console.error(`Tâche quotidienne « ${name} » en échec`, error);
      errors.push(`${name} : ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await step("devis expirés", async () => {
    summary.expiredQuotes = await expireQuotes(today);
  });
  await step("abonnements", async () => {
    const result = await billDueSubscriptions(today);
    summary.subscriptionInvoices = result.invoices;
    summary.subscriptionEmails = { sent: result.sent, failed: result.failed };
    for (const error of result.errors) errors.push(`abonnements : ${error}`);
  });
  await step("relances", async () => {
    const settings = await getSettings();
    summary.reminders =
      settings.reminderMode === "AUTOMATIC"
        ? { mode: "AUTOMATIC", ...(await sendDueReminders(today)) }
        : { mode: "MANUAL", toSend: (await reminderProposals(today)).length };
  });

  await step("relances des devis", async () => {
    summary.quoteReminders = await sendDueQuoteReminders(today);
  });

  await db.taskRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      summary: summary as unknown as Prisma.InputJsonValue,
      error: errors.join("\n"),
    },
  });
  return { summary, errors };
}

export function lastTaskRuns(take = 10) {
  return db.taskRun.findMany({
    orderBy: { startedAt: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });
}
