import "server-only";
import { db } from "@/server/db";
import { getSettings } from "@/modules/settings/service";

/** Données nécessaires aux éditeurs de devis et de factures : réglages, catalogue actif, types de sites. */
export async function loadDocumentEditorData(currentSiteTypeId: string | null = null) {
  const [settings, catalog, siteTypes] = await Promise.all([
    getSettings(),
    db.catalogItem.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        nameDe: true,
        description: true,
        descriptionDe: true,
        category: true,
        lineType: true,
        periodicity: true,
        unit: true,
        unitPriceCents: true,
      },
    }),
    db.siteType.findMany({
      where: { OR: [{ active: true }, ...(currentSiteTypeId ? [{ id: currentSiteTypeId }] : [])] },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  return { settings, catalog, siteTypes };
}
