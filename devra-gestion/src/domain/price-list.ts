/**
 * Tarifs publics (adresse /tarif.php) : les prestations actives du catalogue,
 * groupées par catégorie, pour que le site vitrine affiche des prix à jour.
 * Module pur : la route lit la base et renvoie ce résultat en JSON.
 */
import type { LineTypeCode, PeriodicityCode } from "@/domain/catalog";
import { LINE_TYPE_LABELS } from "@/domain/catalog";
import { unitLabel, type UnitCode } from "@/domain/units";
import { documentLabels } from "@/i18n/documents";
import { formatChf } from "@/lib/format";

export type PriceListSource = {
  id: string;
  name: string;
  nameDe: string;
  description: string;
  descriptionDe: string;
  category: string;
  lineType: LineTypeCode;
  unit: UnitCode;
  unitPriceCents: number;
  periodicity: PeriodicityCode | null;
  updatedAt: Date;
};

const PERIOD_KEYS = { MONTHLY: "perMonth", QUARTERLY: "perQuarter", YEARLY: "perYear" } as const;

/** « CHF 1'490.00 », « CHF 90.00 / heure », « CHF 29.00 par mois ». */
export function priceText(
  item: Pick<PriceListSource, "unit" | "unitPriceCents" | "periodicity">,
  language: "FR" | "DE",
): string {
  const amount = formatChf(item.unitPriceCents);
  if (item.periodicity) {
    return `${amount} ${documentLabels(language)[PERIOD_KEYS[item.periodicity]]}`;
  }
  return item.unit === "FLAT" ? amount : `${amount} / ${unitLabel(item.unit, language)}`;
}

function entry(item: PriceListSource) {
  const de = documentLabels("DE");
  const fr = documentLabels("FR");
  return {
    id: item.id,
    nom: item.name,
    nomDe: item.nameDe || item.name,
    description: item.description,
    descriptionDe: item.descriptionDe || item.description,
    type: item.lineType,
    typeLibelle: LINE_TYPE_LABELS[item.lineType],
    prix: item.unitPriceCents / 100,
    prixCentimes: item.unitPriceCents,
    prixTexte: priceText(item, "FR"),
    prixTexteDe: priceText(item, "DE"),
    unite: item.unit,
    uniteLibelle: unitLabel(item.unit, "FR"),
    uniteLibelleDe: unitLabel(item.unit, "DE"),
    periodicite: item.periodicity,
    periodiciteLibelle: item.periodicity ? fr[PERIOD_KEYS[item.periodicity]] : null,
    periodiciteLibelleDe: item.periodicity ? de[PERIOD_KEYS[item.periodicity]] : null,
  };
}

export type PriceListEntry = ReturnType<typeof entry>;

/**
 * Liste publique : catégories dans l'ordre du catalogue (prestations sans
 * catégorie à la fin, sous `categorie: null`), et les informations de TVA
 * nécessaires pour présenter les prix correctement.
 */
export function publicPriceList(input: {
  company: string;
  vat: { enabled: boolean; rateBps: number | null };
  items: PriceListSource[];
  now: Date;
}) {
  const groups = new Map<string, PriceListEntry[]>();
  for (const item of input.items) {
    const key = item.category.trim();
    groups.set(key, [...(groups.get(key) ?? []), entry(item)]);
  }
  const categories = [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "fr")))
    .map(([name, prestations]) => ({ categorie: name || null, prestations }));
  const latest = input.items.reduce<Date | null>(
    (max, item) => (!max || item.updatedAt > max ? item.updatedAt : max),
    null,
  );

  return {
    entreprise: input.company,
    devise: "CHF",
    tva: {
      // Assujettie : prix hors TVA, la TVA s'ajoute au taux indiqué. Sinon : prix finaux.
      assujettie: input.vat.enabled,
      taux: input.vat.enabled && input.vat.rateBps !== null ? input.vat.rateBps / 100 : null,
      prixHorsTva: input.vat.enabled,
    },
    miseAJour: (latest ?? input.now).toISOString(),
    nombrePrestations: input.items.length,
    categories,
  };
}
