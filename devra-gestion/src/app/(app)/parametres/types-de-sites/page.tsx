import type { Metadata } from "next";
import { SiteTypesEditor } from "@/app/(app)/parametres/types-de-sites/site-types-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listSiteTypesWithUsage } from "@/modules/site-types/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Types de sites" };

export default async function SiteTypesPage() {
  await requireRole("ADMIN");
  const siteTypes = await listSiteTypesWithUsage();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Types de sites</CardTitle>
        <CardDescription>
          Proposés sur la fiche client (« type de site demandé ») et utilisés dans les statistiques.
          Un type utilisé ne peut pas être supprimé, mais il peut être désactivé : il n&apos;est
          alors plus proposé, sans disparaître des fiches existantes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SiteTypesEditor
          siteTypes={siteTypes.map((t) => ({
            id: t.id,
            name: t.name,
            active: t.active,
            usage: t._count.clients,
          }))}
        />
      </CardContent>
    </Card>
  );
}
