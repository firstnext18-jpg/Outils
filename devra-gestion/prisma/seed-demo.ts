/**
 * Données de démonstration : clients fictifs (les phases suivantes ajouteront
 * devis et factures). À utiliser en développement ou pour une présentation,
 * jamais sur la base de production.
 *
 * Lancement : `npm run db:seed:demo` (après `npm run db:seed`).
 */
import "dotenv/config";
import type { CantonCode } from "@/domain/cantons";
import { clientInputSchema, EMPTY_CLIENT, type ClientInput } from "@/modules/clients/schemas";
import { withComputedColumns } from "@/modules/clients/computed-columns";
import { db } from "@/server/db";

type Demo = Partial<ClientInput> & { siteType?: string; archived?: boolean };

const company = (
  companyName: string,
  contactName: string,
  street: string,
  streetNumber: string,
  postalCode: string,
  city: string,
  canton: CantonCode,
  extra: Demo = {},
): Demo => ({
  kind: "COMPANY",
  companyName,
  contactName,
  street,
  streetNumber,
  postalCode,
  city,
  canton,
  ...extra,
});

const person = (
  firstName: string,
  lastName: string,
  street: string,
  streetNumber: string,
  postalCode: string,
  city: string,
  canton: CantonCode,
  extra: Demo = {},
): Demo => ({
  kind: "INDIVIDUAL",
  firstName,
  lastName,
  street,
  streetNumber,
  postalCode,
  city,
  canton,
  ...extra,
});

const CLIENTS: Demo[] = [
  company(
    "Boulangerie des Alpes Sàrl",
    "Claire Morel",
    "Rue du Bourg",
    "8",
    "1003",
    "Lausanne",
    "VD",
    {
      email: "info@boulangerie-alpes.example",
      phone: "021 555 01 01",
      siteType: "Vitrine",
      tags: ["commerce"],
    },
  ),
  company("Weinhandel Seeblick GmbH", "Thomas Keller", "Seestrasse", "45", "8002", "Zürich", "ZH", {
    email: "kontakt@seeblick-wein.example",
    phone: "044 555 02 02",
    siteType: "E-commerce",
    language: "DE",
    tags: ["vin", "boutique"],
  }),
  company("Atelier Nord Design", "Inès Favre", "Rue de Carouge", "12", "1205", "Genève", "GE", {
    email: "hello@atelier-nord.example",
    siteType: "Portfolio",
    tags: ["créatif"],
  }),
  company(
    "Cabinet Physio Rive",
    "Loïc Perret",
    "Quai Louis-Perrier",
    "3",
    "2000",
    "Neuchâtel",
    "NE",
    {
      email: "rdv@physio-rive.example",
      phone: "032 555 03 03",
      siteType: "Landing page",
      tags: ["santé"],
    },
  ),
  company("Garage du Lac SA", "Nadia Rochat", "Avenue des Alpes", "70", "1820", "Montreux", "VD", {
    email: "garage@dulac.example",
    phone: "021 555 04 04",
    website: "garage-du-lac.example",
    siteType: "Refonte",
  }),
  company("Café Lumière", "Hugo Clerc", "Rue de Lausanne", "22", "1700", "Fribourg", "FR", {
    email: "bonjour@cafe-lumiere.example",
    siteType: "Vitrine",
    tags: ["restauration", "prospect"],
  }),
  company("Bergsport Huber AG", "Anna Huber", "Poststrasse", "5", "7000", "Chur", "GR", {
    email: "info@bergsport-huber.example",
    phone: "081 555 05 05",
    siteType: "E-commerce",
    language: "DE",
    tags: ["boutique"],
  }),
  company("Fiduciaire Carrel", "Pierre Carrel", "Rue de la Dixence", "19", "1950", "Sion", "VS", {
    email: "contact@fiduciaire-carrel.example",
    siteType: "Sur mesure",
    notes: "Souhaite un espace client sécurisé.",
  }),
  company("Schreinerei Holzwerk", "Martin Brunner", "Länggassstrasse", "31", "3012", "Bern", "BE", {
    email: "werkstatt@holzwerk.example",
    siteType: "Vitrine",
    language: "DE",
  }),
  company(
    "Studio Yoga Soleil",
    "Emma Jaquier",
    "Rue du Lac",
    "14",
    "1400",
    "Yverdon-les-Bains",
    "VD",
    {
      email: "namaste@yoga-soleil.example",
      siteType: "Landing page",
      tags: ["prospect"],
    },
  ),
  company("Maison Delacroix Traiteur", "Paul Delacroix", "Grand-Rue", "2", "1260", "Nyon", "VD", {
    email: "commandes@delacroix-traiteur.example",
    siteType: "Vitrine",
    tags: ["restauration"],
    archived: true,
  }),
  person("Sophie", "Vuilleumier", "Rue Léopold-Robert", "40", "2300", "La Chaux-de-Fonds", "NE", {
    email: "sophie.vuilleumier@mail.example",
    siteType: "Blog",
  }),
  person("Marco", "Bernasconi", "Via Nassa", "7", "6900", "Lugano", "TI", {
    email: "marco.bernasconi@mail.example",
    siteType: "Portfolio",
    tags: ["photographe"],
  }),
  person("Julie", "Fontaine", "Boulevard Carl-Vogt", "55", "1205", "Genève", "GE", {
    email: "julie.fontaine@mail.example",
    siteType: "Blog",
    tags: ["prospect"],
  }),
  person("Luca", "Rossi", "Zentralstrasse", "63", "2502", "Biel/Bienne", "BE", {
    email: "luca.rossi@mail.example",
    siteType: "Portfolio",
    language: "DE",
  }),
];

async function main() {
  if ((await db.client.count()) > 0) {
    console.log("Des clients existent déjà : aucune donnée de démonstration ajoutée.");
    return;
  }
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  const siteTypes = await db.siteType.findMany();

  for (const { siteType, archived, ...demo } of CLIENTS) {
    const data = clientInputSchema.parse({
      ...EMPTY_CLIENT,
      ...demo,
      siteTypeId: siteTypes.find((t) => t.name === siteType)?.id ?? null,
    });
    await db.client.create({
      data: {
        ...withComputedColumns(data),
        archivedAt: archived ? new Date() : null,
        createdById: admin?.id,
        updatedById: admin?.id,
      },
    });
  }
  console.log(`✓ ${CLIENTS.length} clients de démonstration créés.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
