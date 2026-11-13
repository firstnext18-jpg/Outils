import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isoToDbDate, todayIso, yearOf } from "@/domain/dates";
import { vatIncluded } from "@/domain/expenses";
import { normalizeSearchText, searchWords } from "@/domain/search";
import { formatChf } from "@/lib/format";
import type { ExpenseData, ExpenseListParams } from "@/modules/expenses/schemas";
import { storeFiles } from "@/modules/files/service";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import { deleteStoredFiles } from "@/server/files";
import type { CurrentUser } from "@/server/session";

/** Dépenses de l'entreprise, avec leurs justificatifs (fichiers). */

const listSelect = {
  id: true,
  date: true,
  supplier: true,
  description: true,
  amountCents: true,
  vatCents: true,
  method: true,
  category: { select: { id: true, name: true } },
  client: { select: { id: true, displayName: true } },
  project: { select: { id: true, name: true } },
  _count: { select: { receipts: true } },
} satisfies Prisma.ExpenseSelect;

export type ExpenseRow = Prisma.ExpenseGetPayload<{ select: typeof listSelect }>;

/** Période par défaut : l'année en cours. */
function period(params: ExpenseListParams) {
  const year = yearOf(todayIso());
  return { from: params.du ?? `${year}-01-01`, to: params.au ?? `${year}-12-31` };
}

export async function listExpenses(params: ExpenseListParams) {
  const { from, to } = period(params);
  const where: Prisma.ExpenseWhereInput = {
    date: { gte: isoToDbDate(from), lte: isoToDbDate(to) },
    ...(params.categorie ? { categoryId: params.categorie } : {}),
    AND: searchWords(params.q ?? "").map((word) => ({ searchText: { contains: word } })),
  };
  const [expenses, byCategory] = await Promise.all([
    db.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: listSelect,
    }),
    db.expense.groupBy({ by: ["categoryId"], where, _sum: { amountCents: true, vatCents: true } }),
  ]);
  const categories = await db.listItem.findMany({
    where: {
      id: { in: byCategory.map((c) => c.categoryId).filter((v): v is string => Boolean(v)) },
    },
    select: { id: true, name: true },
  });
  return {
    expenses,
    from,
    to,
    totalCents: byCategory.reduce((sum, c) => sum + (c._sum.amountCents ?? 0), 0),
    vatCents: byCategory.reduce((sum, c) => sum + (c._sum.vatCents ?? 0), 0),
    byCategory: byCategory
      .map((c) => ({
        name: categories.find((cat) => cat.id === c.categoryId)?.name ?? "Sans catégorie",
        amountCents: c._sum.amountCents ?? 0,
      }))
      .sort((a, b) => b.amountCents - a.amountCents),
  };
}

export function getExpense(id: string) {
  return db.expense.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      client: {
        select: { id: true, displayName: true, city: true, language: true, siteTypeId: true },
      },
      project: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      receipts: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, size: true, createdAt: true },
      },
    },
  });
}

/** Total des dépenses d'une période (tableau de bord). */
export async function expensesTotal(range: { from: string; to: string }) {
  const sum = await db.expense.aggregate({
    where: { date: { gte: isoToDbDate(range.from), lte: isoToDbDate(range.to) } },
    _sum: { amountCents: true },
  });
  return sum._sum.amountCents ?? 0;
}

async function checkLinks(data: ExpenseData) {
  if (data.categoryId) {
    const category = await db.listItem.findFirst({
      where: { id: data.categoryId, kind: "EXPENSE_CATEGORY" },
    });
    if (!category) throw new UserError("Cette catégorie n'existe plus.");
  }
  if (data.projectId) {
    const project = await db.project.findUnique({
      where: { id: data.projectId },
      select: { clientId: true },
    });
    if (!project) throw new UserError("Ce projet n'existe plus.");
    // Le projet impose son client.
    return { ...data, clientId: project.clientId };
  }
  return data;
}

function columns(data: ExpenseData) {
  return {
    date: isoToDbDate(data.date),
    supplier: data.supplier,
    description: data.description,
    categoryId: data.categoryId,
    amountCents: data.amountCents,
    vatRateBps: data.vatRateBps,
    vatCents: vatIncluded(data.amountCents, data.vatRateBps),
    method: data.method,
    clientId: data.clientId,
    projectId: data.projectId,
    notes: data.notes,
    searchText: normalizeSearchText(`${data.supplier} ${data.description} ${data.notes}`),
  };
}

export async function createExpense(actor: CurrentUser, input: ExpenseData, receipts: File[]) {
  const data = await checkLinks(input);
  const expense = await db.expense.create({ data: { ...columns(data), createdById: actor.id } });
  if (receipts.length) {
    await storeFiles(receipts, {
      expenseId: expense.id,
      visibleToClient: false,
      uploadedById: actor.id,
    }).catch(async (error: unknown) => {
      await db.expense.delete({ where: { id: expense.id } });
      throw error;
    });
  }
  await logActivity({
    userId: actor.id,
    action: "expense.created",
    entityType: "expense",
    entityId: expense.id,
    label: data.description,
    details: { amount: formatChf(data.amountCents) },
  });
  return expense;
}

export async function updateExpense(actor: CurrentUser, id: string, input: ExpenseData) {
  const existing = await db.expense.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new UserError("Cette dépense n'existe plus.");
  const data = await checkLinks(input);
  const expense = await db.expense.update({ where: { id }, data: columns(data) });
  await logActivity({
    userId: actor.id,
    action: "expense.updated",
    entityType: "expense",
    entityId: id,
    label: data.description,
    details: { amount: formatChf(data.amountCents) },
  });
  return expense;
}

export async function addReceipts(actor: CurrentUser, id: string, receipts: File[]) {
  const expense = await db.expense.findUnique({ where: { id }, select: { id: true } });
  if (!expense) throw new UserError("Cette dépense n'existe plus.");
  await storeFiles(receipts, { expenseId: id, visibleToClient: false, uploadedById: actor.id });
}

export async function deleteExpense(actor: CurrentUser, id: string) {
  const expense = await db.expense.findUnique({
    where: { id },
    include: { receipts: { select: { storageName: true } } },
  });
  if (!expense) throw new UserError("Cette dépense n'existe plus.");
  await db.expense.delete({ where: { id } });
  await deleteStoredFiles(expense.receipts.map((r) => r.storageName));
  await logActivity({
    userId: actor.id,
    action: "expense.deleted",
    entityType: "expense",
    entityId: id,
    label: expense.description,
    details: { amount: formatChf(expense.amountCents) },
  });
}
