import { publicPriceList } from "@/domain/price-list";
import { listPublicCatalogItems } from "@/modules/catalog/service";
import { displayCompanyName, getSettings } from "@/modules/settings/service";

export const dynamic = "force-dynamic";

/**
 * Tarifs publics pour le site vitrine : toutes les prestations actives du
 * catalogue, en JSON. Public (pas de connexion) et lisible depuis n'importe
 * quel site (CORS). Désactiver une prestation la retire de la liste.
 * Format documenté dans docs/TARIFS_SITE_VITRINE.md.
 */
export async function GET() {
  const [settings, items] = await Promise.all([getSettings(), listPublicCatalogItems()]);
  const body = publicPriceList({
    company: displayCompanyName(settings),
    vat: { enabled: settings.vatEnabled, rateBps: settings.vatRates[0] ?? null },
    items,
    now: new Date(),
  });
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
