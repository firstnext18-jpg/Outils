import type { Metadata } from "next";
import Link from "next/link";
import { ExpenseForm } from "@/app/(app)/depenses/expense-form";
import { todayIso } from "@/domain/dates";
import { listOptions } from "@/modules/lists/service";
import { openProjectOptions } from "@/modules/projects/service";
import { getSettings } from "@/modules/settings/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouvelle dépense" };

export default async function NewExpensePage() {
  await requireRole("MEMBER");
  const [categories, settings, projects] = await Promise.all([
    listOptions("EXPENSE_CATEGORY"),
    getSettings(),
    openProjectOptions(),
  ]);
  return (
    <>
      <div className="space-y-2">
        <Link href="/depenses" className="text-muted-foreground text-sm hover:underline">
          ← Dépenses
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle dépense</h1>
      </div>
      <ExpenseForm
        client={null}
        categories={categories}
        vatRates={settings.vatEnabled ? settings.vatRates : []}
        projects={projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId }))}
        defaultValues={{
          date: todayIso(),
          supplier: "",
          description: "",
          categoryId: null,
          amount: "",
          vatRateBps: null,
          method: "BANK_TRANSFER",
          clientId: null,
          projectId: null,
          notes: "",
        }}
      />
    </>
  );
}
