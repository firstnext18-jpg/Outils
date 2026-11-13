import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteExpenseButton } from "@/app/(app)/depenses/[id]/delete-expense-button";
import { Receipts } from "@/app/(app)/depenses/[id]/receipts";
import { ExpenseForm } from "@/app/(app)/depenses/expense-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dbDateToIso } from "@/domain/dates";
import { canEdit } from "@/domain/roles";
import { formatAmount, formatChf, formatDateTime } from "@/lib/format";
import { getExpense } from "@/modules/expenses/service";
import { listOptions } from "@/modules/lists/service";
import { openProjectOptions } from "@/modules/projects/service";
import { getSettings } from "@/modules/settings/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Dépense" };

export default async function ExpensePage({ params }: PageProps<"/depenses/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const expense = /^[0-9a-f-]{36}$/i.test(id) ? await getExpense(id) : null;
  if (!expense) notFound();
  const editable = canEdit(user.role);
  const [categories, settings, projects] = await Promise.all([
    listOptions("EXPENSE_CATEGORY", expense.categoryId),
    getSettings(),
    openProjectOptions(),
  ]);
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }));
  if (
    expense.project &&
    !projectOptions.some((p) => p.id === expense.project!.id) &&
    expense.clientId
  ) {
    projectOptions.push({
      id: expense.project.id,
      name: expense.project.name,
      clientId: expense.clientId,
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/depenses" className="text-muted-foreground text-sm hover:underline">
            ← Dépenses
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{expense.description}</h1>
          <p className="text-muted-foreground text-sm">
            {formatChf(expense.amountCents)}
            {expense.vatCents > 0 && ` dont TVA ${formatChf(expense.vatCents)}`} · enregistrée le{" "}
            {formatDateTime(expense.createdAt)}
            {expense.createdBy && ` par ${expense.createdBy.name}`}
          </p>
        </div>
        {editable && <DeleteExpenseButton id={expense.id} />}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {editable ? (
            <ExpenseForm
              expenseId={expense.id}
              client={expense.client}
              categories={categories}
              vatRates={settings.vatEnabled || expense.vatRateBps ? settings.vatRates : []}
              projects={projectOptions}
              defaultValues={{
                date: dbDateToIso(expense.date),
                supplier: expense.supplier,
                description: expense.description,
                categoryId: expense.categoryId,
                amount: formatAmount(expense.amountCents),
                vatRateBps: expense.vatRateBps,
                method: expense.method,
                clientId: expense.clientId,
                projectId: expense.projectId,
                notes: expense.notes,
              }}
            />
          ) : (
            <Card>
              <CardContent className="space-y-1 pt-6 text-sm">
                <p>{[expense.supplier, expense.category?.name].filter(Boolean).join(" · ")}</p>
                {expense.notes && <p className="whitespace-pre-wrap">{expense.notes}</p>}
              </CardContent>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Justificatifs</CardTitle>
            <CardDescription>Gardés avec la dépense (et dans les sauvegardes).</CardDescription>
          </CardHeader>
          <CardContent>
            <Receipts
              expenseId={expense.id}
              canEdit={editable}
              receipts={expense.receipts.map((r) => ({
                id: r.id,
                name: r.name,
                size: r.size,
                meta: formatDateTime(r.createdAt),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
