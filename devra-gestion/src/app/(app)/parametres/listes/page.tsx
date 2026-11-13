import type { Metadata } from "next";
import { ListEditor } from "@/app/(app)/parametres/listes/list-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LIST_KINDS, LIST_LABELS } from "@/domain/lists";
import { listItemsWithUsage } from "@/modules/lists/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Listes" };

export default async function ListsSettingsPage() {
  await requireRole("ADMIN");
  const lists = await Promise.all(
    LIST_KINDS.map(async (kind) => ({ kind, items: await listItemsWithUsage(kind) })),
  );
  return (
    <div className="space-y-6">
      {lists.map(({ kind, items }) => (
        <Card key={kind}>
          <CardHeader>
            <CardTitle>{LIST_LABELS[kind].title}</CardTitle>
            <CardDescription>
              {LIST_LABELS[kind].description} Une valeur utilisée ne peut pas être supprimée, mais
              elle peut être désactivée : elle n&apos;est alors plus proposée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ListEditor kind={kind} items={items} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
