/**
 * Données de démonstration : clients fictifs et devis dans différents statuts
 * (les factures s'ajouteront en phase 5). À utiliser en développement ou pour
 * une présentation, jamais sur la base de production.
 *
 * Lancement : `npm run db:seed:demo` (après `npm run db:seed`).
 */
import "dotenv/config";
import type { CantonCode } from "@/domain/cantons";
import { clientInputSchema, EMPTY_CLIENT, type ClientInput } from "@/modules/clients/schemas";
import { addDays, isoToDbDate, todayIso, yearOf } from "@/domain/dates";
import { normalizeSearchText } from "@/domain/search";
import { withComputedColumns } from "@/modules/clients/computed-columns";
import { quoteColumns } from "@/modules/quotes/columns";
import { emptyLine, lineFromCatalog } from "@/modules/quotes/form";
import { quoteInputSchema } from "@/modules/quotes/schemas";
import { db } from "@/server/db";
import { allocateDocumentNumber } from "@/server/numbering";

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

async function seedClients() {
  if ((await db.client.count()) > 0) {
    console.log("Des clients existent déjà : aucun client de démonstration ajouté.");
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

type DemoQuote = {
  client: string;
  subject: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REFUSED" | "EXPIRED";
  /** Date du devis : aujourd'hui moins ce nombre de jours. */
  daysAgo: number;
  items: [name: string, quantity?: string][];
  globalDiscount?: string;
  deposit?: string;
};

const QUOTES: DemoQuote[] = [
  {
    client: "Boulangerie des Alpes Sàrl",
    subject: "Création de votre site vitrine",
    status: "SENT",
    daysAgo: 10,
    items: [
      ["Site vitrine (jusqu'à 5 pages)"],
      ["Page supplémentaire", "2"],
      ["Hébergement + maintenance"],
    ],
    deposit: "30",
  },
  {
    client: "Weinhandel Seeblick GmbH",
    subject: "Onlineshop für Ihre Weine",
    status: "ACCEPTED",
    daysAgo: 25,
    items: [
      ["Boutique en ligne"],
      ["Version bilingue (français / allemand)"],
      ["Hébergement + maintenance (annuel)"],
    ],
    globalDiscount: "5",
    deposit: "30",
  },
  {
    client: "Café Lumière",
    subject: "Landing page de lancement",
    status: "DRAFT",
    daysAgo: 1,
    items: [["Landing page"], ["Formulaire de contact"]],
  },
  {
    client: "Garage du Lac SA",
    subject: "Refonte du site",
    status: "REFUSED",
    daysAgo: 40,
    items: [["Refonte d'un site existant"], ["Modification sur demande", "4"]],
  },
  {
    client: "Studio Yoga Soleil",
    subject: "Page de présentation des cours",
    status: "EXPIRED",
    daysAgo: 60,
    items: [["Landing page"], ["Nom de domaine .ch"]],
  },
  {
    client: "Atelier Nord Design",
    subject: "Portfolio en ligne",
    status: "SENT",
    daysAgo: 3,
    items: [["Site vitrine (jusqu'à 5 pages)"], ["Page supplémentaire", "3"]],
  },
];

async function seedQuotes() {
  if ((await db.quote.count()) > 0) {
    console.log("Des devis existent déjà : aucun devis de démonstration ajouté.");
    return;
  }
  const settings = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  const catalog = await db.catalogItem.findMany();
  const vatRate = settings.vatEnabled ? (settings.vatRates[0] ?? null) : null;
  let created = 0;

  for (const demo of QUOTES) {
    const client = await db.client.findFirst({ where: { displayName: demo.client } });
    if (!client) continue;
    const issueDate = addDays(todayIso(), -demo.daysAgo);
    const lines = demo.items.map(([name, quantity]) => {
      const item = catalog.find((c) => c.name === name);
      const line = item
        ? lineFromCatalog(item, client.language, vatRate)
        : { ...emptyLine(vatRate), label: name, unitPrice: "100" };
      return { ...line, quantity: quantity ?? "1" };
    });
    const data = quoteInputSchema.parse({
      clientId: client.id,
      language: client.language,
      issueDate,
      validUntil: addDays(issueDate, settings.quoteValidityDays),
      subject: demo.subject,
      siteTypeId: client.siteTypeId,
      introText: client.language === "DE" ? settings.quoteIntroDe : settings.quoteIntroFr,
      conditionsText:
        client.language === "DE" ? settings.quoteConditionsDe : settings.quoteConditionsFr,
      globalDiscountType: "PERCENT",
      globalDiscountValue: demo.globalDiscount ?? "",
      depositType: "PERCENT",
      depositValue: demo.deposit ?? "",
      lines,
    });
    const { columns, lines: lineRows } = quoteColumns(data, settings.vatEnabled);
    const sentAt = demo.status === "DRAFT" ? null : isoToDbDate(issueDate);
    await db.$transaction(async (tx) => {
      const year = yearOf(issueDate);
      const { number, sequence } = await allocateDocumentNumber(
        tx,
        "QUOTE",
        year,
        settings.quoteNumberFormat,
      );
      await tx.quote.create({
        data: {
          ...columns,
          number,
          year,
          sequence,
          status: demo.status,
          sentAt,
          decidedAt:
            demo.status === "ACCEPTED" || demo.status === "REFUSED"
              ? isoToDbDate(addDays(issueDate, 5))
              : null,
          searchText: normalizeSearchText(`${number} ${demo.subject}`),
          createdById: admin?.id,
          updatedById: admin?.id,
          lines: { create: lineRows },
        },
      });
    });
    created += 1;
  }
  console.log(`✓ ${created} devis de démonstration créés.`);
}

async function main() {
  await seedClients();
  await seedQuotes();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
