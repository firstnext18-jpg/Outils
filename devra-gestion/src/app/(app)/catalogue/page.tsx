import type { Metadata } from "next";
import { PackageIcon, SearchXIcon } from "lucide-react";
import { CatalogItemActions, NewCatalogItemButton } from "@/app/(app)/catalogue/catalog-actions";
import { CatalogToolbar } from "@/app/(app)/catalogue/catalog-toolbar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { LINE_TYPE_LABELS, PERIODICITY_LABELS, priceSuffix } from "@/domain/catalog";
import { canEdit } from "@/domain/roles";
import { formatChf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { catalogListParamsSchema } from "@/modules/catalog/schemas";
import {
  countCatalogItems,
  listCatalogCategories,
  listCatalogItems,
  type CatalogItemRow,
} from "@/modules/catalog/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Catalogue" };

const NO_CATEGORY = "Sans catégorie";

function groupByCategory(items: CatalogItemRow[]) {
  const groups = new Map<string, CatalogItemRow[]>();
  for (const item of items) {
    const key = item.category || NO_CATEGORY;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  // « Sans catégorie » en dernier.
  return [...groups.entries()].sort(([a], [b]) =>
    a === NO_CATEGORY ? 1 : b === NO_CATEGORY ? -1 : a.localeCompare(b, "fr"),
  );
}

export default async function CatalogPage({ searchParams }: PageProps<"/catalogue">) {
  const user = await requireUser();
  const params = catalogListParamsSchema.parse(await searchParams);
  const [items, categories, total] = await Promise.all([
    listCatalogItems(params),
    listCatalogCategories(),
    countCatalogItems(),
  ]);
  const editable = canEdit(user.role);

  return (
    <>
      <PageHeader
        title="Catalogue"
        description="Prestations réutilisables dans les devis et les factures. Prix hors TVA."
        actions={editable && <NewCatalogItemButton categories={categories} />}
      />
      {total === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="Aucune prestation pour l'instant"
          description="Ajoutez vos forfaits, tarifs horaires, options et abonnements pour les reprendre en un clic dans vos devis."
          action={editable && <NewCatalogItemButton categories={categories} />}
        />
      ) : (
        <>
          <CatalogToolbar categories={categories} />
          {items.length === 0 ? (
            <EmptyState
              icon={SearchXIcon}
              title="Aucune prestation ne correspond"
              description="Modifiez la recherche ou les filtres."
            />
          ) : (
            <div className="space-y-6">
              {groupByCategory(items).map(([category, group]) => (
                <section key={category} className="space-y-2" aria-labelledby={`cat-${category}`}>
                  <h2 id={`cat-${category}`} className="text-muted-foreground text-sm font-medium">
                    {category}
                  </h2>
                  <ul className="divide-y rounded-lg border">
                    {group.map((item) => (
                      <li
                        key={item.id}
                        className={cn(
                          "flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4",
                          !item.active && "bg-muted/40",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn("font-medium", !item.active && "text-muted-foreground")}
                            >
                              {item.name}
                            </span>
                            <Badge variant="secondary" className="font-normal">
                              {LINE_TYPE_LABELS[item.lineType]}
                              {item.periodicity &&
                                ` · ${PERIODICITY_LABELS[item.periodicity].toLowerCase()}`}
                            </Badge>
                            {!item.active && <Badge variant="outline">Désactivée</Badge>}
                          </div>
                          {item.description && (
                            <p className="text-muted-foreground line-clamp-2 text-sm">
                              {item.description}
                            </p>
                          )}
                          {item.nameDe && (
                            <p className="text-muted-foreground text-xs">
                              <span className="font-medium">DE</span> · {item.nameDe}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                          <span className="font-medium whitespace-nowrap tabular-nums">
                            {formatChf(item.unitPriceCents)}
                            <span className="text-muted-foreground">{priceSuffix(item.unit)}</span>
                          </span>
                          {editable && <CatalogItemActions item={item} categories={categories} />}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
