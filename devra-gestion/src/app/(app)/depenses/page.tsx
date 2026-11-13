import type { Metadata } from "next";
import { PaperclipIcon, PlusIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { canEdit } from "@/domain/roles";
import { formatChf } from "@/lib/format";
import { expenseListParamsSchema } from "@/modules/expenses/schemas";
import { listExpenses } from "@/modules/expenses/service";
import { listOptions } from "@/modules/lists/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Dépenses" };

export default async function ExpensesPage({ searchParams }: PageProps<"/depenses">) {
  const user = await requireUser();
  const params = expenseListParamsSchema.parse(await searchParams);
  const [list, categories] = await Promise.all([
    listExpenses(params),
    listOptions("EXPENSE_CATEGORY"),
  ]);

  return (
    <>
      <PageHeader
        title="Dépenses"
        description="Ce que l'entreprise paie : hébergements, logiciels, sous-traitance… avec les justificatifs."
        actions={
          canEdit(user.role) && (
            <Button asChild>
              <Link href="/depenses/nouvelle">
                <PlusIcon /> Nouvelle dépense
              </Link>
            </Button>
          )
        }
      />
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1">
          <Label htmlFor="expenses-from">Du</Label>
          <Input
            id="expenses-from"
            type="date"
            name="du"
            defaultValue={list.from}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="expenses-to">Au</Label>
          <Input id="expenses-to" type="date" name="au" defaultValue={list.to} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="expenses-category">Catégorie</Label>
          <select
            id="expenses-category"
            name="categorie"
            defaultValue={params.categorie ?? ""}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="expenses-q">Recherche</Label>
          <Input id="expenses-q" name="q" defaultValue={params.q ?? ""} className="w-48" />
        </div>
        <Button type="submit" variant="outline">
          Afficher
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Total de la période</CardDescription>
          </CardHeader>
          <CardContent className="px-4 text-xl font-semibold tabular-nums">
            {formatChf(list.totalCents)}
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Dont TVA (impôt préalable)</CardDescription>
          </CardHeader>
          <CardContent className="px-4 text-xl font-semibold tabular-nums">
            {formatChf(list.vatCents)}
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardDescription>Par catégorie</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0.5 px-4 text-sm">
            {list.byCategory.slice(0, 4).map((c) => (
              <div key={c.name} className="flex justify-between gap-2">
                <span className="truncate">{c.name}</span>
                <span className="tabular-nums">{formatChf(c.amountCents)}</span>
              </div>
            ))}
            {list.byCategory.length === 0 && <span className="text-muted-foreground">—</span>}
          </CardContent>
        </Card>
      </div>

      {list.expenses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Du {formatIsoDate(list.from)} au {formatIsoDate(list.to)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border" aria-label="Dépenses">
              {list.expenses.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/depenses/${e.id}`}
                    className="hover:bg-muted/50 flex flex-wrap items-center gap-3 p-3 text-sm"
                  >
                    <span className="text-muted-foreground w-24 tabular-nums">
                      {formatIsoDate(dbDateToIso(e.date))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{e.description}</div>
                      <div className="text-muted-foreground text-xs">
                        {[e.supplier, e.category?.name, e.client?.displayName, e.project?.name]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {e._count.receipts > 0 && (
                      <PaperclipIcon
                        className="text-muted-foreground size-4"
                        aria-label="Justificatif joint"
                      />
                    )}
                    <span className="font-medium tabular-nums">{formatChf(e.amountCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={WalletIcon}
          title="Aucune dépense sur cette période"
          description="Ajoutez vos dépenses pour suivre votre marge sur le tableau de bord."
        />
      )}
    </>
  );
}
