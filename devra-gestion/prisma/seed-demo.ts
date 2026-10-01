/**
 * Données de démonstration : clients fictifs, devis, factures (dont une
 * relancée) et abonnements dans différents statuts. À utiliser en développement ou pour une présentation,
 * jamais sur la base de production.
 *
 * Lancement : `npm run db:seed:demo` (après `npm run db:seed`).
 */
import "dotenv/config";
import type { CantonCode } from "@/domain/cantons";
import { clientInputSchema, EMPTY_CLIENT, type ClientInput } from "@/modules/clients/schemas";
import { addDays, formatIsoDate, isoToDbDate, todayIso, yearOf } from "@/domain/dates";
import { renderTemplate } from "@/domain/email-template";
import { statusAfterPayments, type PaymentMethod } from "@/domain/invoice-status";
import { depositParts } from "@/domain/invoices";
import { formatPercent } from "@/domain/percent";
import { paymentSetup } from "@/domain/qr-bill";
import { reminderAmounts, type ReminderLevel } from "@/domain/reminders";
import { addMonths, duePeriods, periodStart } from "@/domain/subscriptions";
import { documentLabels, fillLabel } from "@/i18n/documents";
import { formatAmount, formatChf } from "@/lib/format";
import type { DocumentLineInput } from "@/modules/documents/lines";
import { storedDocumentTotals } from "@/modules/documents/lines";
import { invoiceColumns } from "@/modules/invoices/columns";
import { invoiceInputSchema } from "@/modules/invoices/schemas";
import {
  clientSnapshot,
  companySnapshot,
  reminderRules,
  reminderTemplates,
} from "@/modules/settings/documents";
import { periodAmount } from "@/modules/subscriptions/amounts";
import { subscriptionInputSchema } from "@/modules/subscriptions/schemas";
import { normalizeSearchText } from "@/domain/search";
import { withComputedColumns } from "@/modules/clients/computed-columns";
import { quoteColumns } from "@/modules/quotes/columns";
import { emptyLine, lineFromCatalog } from "@/modules/documents/lines";
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

type DemoInvoice = {
  client: string;
  subject: string;
  daysAgo: number;
  /** Lignes du catalogue, ou facture d'acompte du devis accepté de ce client. */
  items: [name: string, quantity?: string][] | "deposit";
  payments?: [daysAgo: number, amount: "all" | string, method: PaymentMethod][];
  draft?: boolean;
  cancelReason?: string;
  /** Relances déjà envoyées (il y a n jours), dans l'ordre des niveaux. */
  reminders?: number[];
};

const INVOICES: DemoInvoice[] = [
  {
    client: "Studio Yoga Soleil",
    subject: "Cours en ligne : mise en place",
    daysAgo: 75,
    items: [["Modification sur demande", "2"]],
    reminders: [20],
  },
  {
    client: "Café Lumière",
    subject: "Formulaire de contact",
    daysAgo: 50,
    items: [["Formulaire de contact"]],
    cancelReason: "Prestation offerte au client",
  },
  {
    client: "Garage du Lac SA",
    subject: "Modifications du site",
    daysAgo: 40,
    items: [["Modification sur demande", "3"]],
  },
  {
    client: "Atelier Nord Design",
    subject: "Site vitrine",
    daysAgo: 30,
    items: [["Site vitrine (jusqu'à 5 pages)"]],
    payments: [[20, "all", "BANK_TRANSFER"]],
  },
  {
    client: "Weinhandel Seeblick GmbH",
    subject: "Onlineshop für Ihre Weine",
    daysAgo: 20,
    items: "deposit",
    payments: [[12, "all", "BANK_TRANSFER"]],
  },
  {
    client: "Café Lumière",
    subject: "Landing page de lancement",
    daysAgo: 10,
    items: [["Landing page"]],
    payments: [[3, "200", "TWINT"]],
  },
  {
    client: "Studio Yoga Soleil",
    subject: "Page de présentation des cours",
    daysAgo: 1,
    items: [["Landing page"]],
    draft: true,
  },
];

async function seedInvoices() {
  if ((await db.invoice.count()) > 0) {
    console.log("Des factures existent déjà : aucune facture de démonstration ajoutée.");
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

  for (const demo of INVOICES) {
    const client = await db.client.findFirst({ where: { displayName: demo.client } });
    if (!client) continue;
    const issueDate = addDays(todayIso(), -demo.daysAgo);
    const texts =
      client.language === "DE"
        ? { introText: settings.invoiceIntroDe, conditionsText: settings.invoiceConditionsDe }
        : { introText: settings.invoiceIntroFr, conditionsText: settings.invoiceConditionsFr };

    let lines: DocumentLineInput[];
    let quoteId: string | null = null;
    if (demo.items === "deposit") {
      const quote = await db.quote.findFirst({
        where: { clientId: client.id, status: "ACCEPTED", depositCents: { gt: 0 } },
        include: { lines: true },
      });
      if (!quote) continue;
      quoteId = quote.id;
      const oneTime = quote.lines.filter((line) => line.lineType !== "SUBSCRIPTION");
      const { totals, deposit } = storedDocumentTotals({ ...quote, lines: oneTime });
      const labels = documentLabels(quote.language);
      const label =
        deposit?.type === "PERCENT"
          ? fillLabel(labels.depositLinePercent, {
              percent: formatPercent(deposit.value),
              number: quote.number,
            })
          : fillLabel(labels.depositLineAmount, { number: quote.number });
      lines = depositParts(totals.oneTime, quote.depositCents, settings.vatEnabled).map((part) => ({
        ...emptyLine(part.vatRateBps),
        label,
        unitPrice: formatAmount(part.netCents),
      }));
    } else {
      lines = demo.items.map(([name, quantity]) => {
        const item = catalog.find((c) => c.name === name);
        const line = item
          ? lineFromCatalog(item, client.language, vatRate)
          : { ...emptyLine(vatRate), label: name, unitPrice: "100" };
        return { ...line, quantity: quantity ?? "1" };
      });
    }
    const data = invoiceInputSchema.parse({
      clientId: client.id,
      language: client.language,
      issueDate,
      dueDate: addDays(issueDate, settings.paymentTermDays),
      subject: demo.subject,
      siteTypeId: client.siteTypeId,
      ...texts,
      globalDiscountType: "PERCENT",
      globalDiscountValue: "",
      lines,
    });
    const { columns, lines: lineRows } = invoiceColumns(data, settings.vatEnabled, []);

    await db.$transaction(async (tx) => {
      const issued = demo.draft
        ? null
        : await (async () => {
            const year = yearOf(issueDate);
            const { number, sequence } = await allocateDocumentNumber(
              tx,
              "INVOICE",
              year,
              settings.invoiceNumberFormat,
            );
            const setup = paymentSetup(settings, { number, year, sequence });
            return {
              number,
              year,
              sequence,
              issuedAt: new Date(`${issueDate}T08:30:00Z`),
              paymentAccount: setup?.account ?? "",
              referenceType: setup?.referenceType ?? null,
              paymentReference: setup?.reference ?? "",
              clientSnapshot: clientSnapshot(client),
              companySnapshot: companySnapshot(settings),
            };
          })();
      const payments = (demo.payments ?? []).map(([daysAgo, amount, method]) => ({
        date: isoToDbDate(addDays(todayIso(), -daysAgo)),
        amountCents: amount === "all" ? columns.amountDueCents : Math.round(Number(amount) * 100),
        method,
        createdById: admin?.id,
      }));
      const paid = payments.reduce((sum, p) => sum + p.amountCents, 0);
      const status = demo.draft
        ? "DRAFT"
        : demo.cancelReason
          ? "CANCELLED"
          : statusAfterPayments(columns.amountDueCents, paid);
      const invoice = await tx.invoice.create({
        data: {
          ...columns,
          ...issued,
          type: demo.items === "deposit" ? "DEPOSIT" : "STANDARD",
          quoteId,
          status,
          paidCents: paid,
          cancelledAt: demo.cancelReason ? isoToDbDate(addDays(issueDate, 3)) : null,
          cancelReason: demo.cancelReason ?? "",
          searchText: normalizeSearchText(`${issued?.number ?? ""} ${demo.subject}`),
          createdById: admin?.id,
          updatedById: admin?.id,
          lines: { create: lineRows },
          payments: { create: payments },
        },
      });

      // Relances déjà envoyées par email, avec leurs frais éventuels.
      let feesCents = 0;
      for (const [index, daysAgo] of (demo.reminders ?? []).entries()) {
        const level = (index + 1) as ReminderLevel;
        const date = addDays(todayIso(), -daysAgo);
        const dueDate = addDays(date, settings.reminderPaymentDays);
        const amounts = reminderAmounts(
          { amountDueCents: columns.amountDueCents, feesCents, paidCents: paid },
          level,
          reminderRules(settings),
        );
        const template = reminderTemplates(settings)[`level${level}`][client.language];
        await tx.reminder.create({
          data: {
            invoiceId: invoice.id,
            level,
            date: isoToDbDate(date),
            dueDate: isoToDbDate(dueDate),
            ...amounts,
            channel: "EMAIL",
            text: renderTemplate(template.text, {
              client: client.contactName || client.displayName,
              numero: invoice.number ?? "",
              date: formatIsoDate(issueDate),
              montant: formatChf(amounts.totalCents),
              echeance: formatIsoDate(dueDate),
              lien: "",
              entreprise: settings.companyName.trim(),
            }),
            createdById: admin?.id,
          },
        });
        feesCents += amounts.feeCents;
      }
      if (feesCents > 0) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { feesCents } });
      }
    });
    created += 1;
  }
  console.log(`✓ ${created} factures de démonstration créées.`);
}

type DemoSubscription = {
  client: string;
  /** Abonnements du catalogue, tous de la même périodicité. */
  items: string[];
  monthsAgo: number;
  /**
   * Périodes commencées considérées comme déjà facturées (avant l'outil) ;
   * sinon, la prochaine exécution des tâches quotidiennes les facture.
   */
  billed: boolean;
  status?: "PAUSED" | "CANCELLED";
};

const SUBSCRIPTIONS: DemoSubscription[] = [
  {
    client: "Garage du Lac SA",
    items: ["Hébergement + maintenance"],
    monthsAgo: 5,
    billed: true,
  },
  {
    client: "Weinhandel Seeblick GmbH",
    items: ["Hébergement + maintenance (annuel)", "Nom de domaine .ch"],
    monthsAgo: 2,
    billed: true,
  },
  {
    client: "Atelier Nord Design",
    items: ["Hébergement + maintenance"],
    monthsAgo: 0,
    billed: false,
  },
  {
    client: "Café Lumière",
    items: ["Nom de domaine .ch"],
    monthsAgo: 14,
    billed: true,
    status: "PAUSED",
  },
  {
    client: "Studio Yoga Soleil",
    items: ["Hébergement + maintenance"],
    monthsAgo: 8,
    billed: true,
    status: "CANCELLED",
  },
];

async function seedSubscriptions() {
  if ((await db.subscription.count()) > 0) {
    console.log("Des abonnements existent déjà : aucun abonnement de démonstration ajouté.");
    return;
  }
  const settings = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  const catalog = await db.catalogItem.findMany({ where: { lineType: "SUBSCRIPTION" } });
  const vatRate = settings.vatEnabled ? (settings.vatRates[0] ?? null) : null;
  const today = todayIso();
  let created = 0;

  for (const demo of SUBSCRIPTIONS) {
    const client = await db.client.findFirst({ where: { displayName: demo.client } });
    const items = demo.items.flatMap((name) => catalog.filter((c) => c.name === name));
    if (!client || items.length !== demo.items.length) continue;
    const periodicity = items[0]!.periodicity ?? "MONTHLY";
    const startDate = addMonths(today, -demo.monthsAgo);
    const data = subscriptionInputSchema.parse({
      clientId: client.id,
      label: items.map((item) => (client.language === "DE" && item.nameDe) || item.name).join(", "),
      periodicity,
      startDate,
      language: client.language,
      notes: "",
      items: items.map((item) => {
        const line = lineFromCatalog(item, client.language, vatRate);
        return {
          catalogItemId: item.id,
          label: line.label,
          description: line.description,
          quantity: "1",
          unitPrice: line.unitPrice,
          discountType: "PERCENT",
          discountValue: "",
          vatRateBps: line.vatRateBps,
        };
      }),
    });
    const rows = data.items.map((item, position) => ({
      position,
      catalogItemId: item.catalogItemId,
      label: item.label,
      description: item.description,
      quantityMilli: item.quantityMilli,
      unitPriceCents: item.unitPriceCents,
      discountType: item.discount?.type ?? null,
      discountValue: item.discount?.value ?? 0,
      vatRateBps: item.vatRateBps,
    }));
    // En pause depuis 20 jours, résilié il y a 15 jours : facturé jusque-là.
    const pausedOn = addDays(today, -20);
    const endDate = addDays(today, -15);
    const billedUntil =
      demo.status === "PAUSED" ? pausedOn : demo.status === "CANCELLED" ? endDate : today;
    const billedPeriods = demo.billed
      ? duePeriods({ startDate, periodicity, billedPeriods: 0 }, billedUntil, 1_000).length
      : 0;
    await db.subscription.create({
      data: {
        clientId: client.id,
        label: data.label,
        periodicity,
        language: data.language,
        notes: "",
        status: demo.status ?? "ACTIVE",
        startDate: isoToDbDate(startDate),
        billedPeriods,
        nextBillingDate: isoToDbDate(periodStart(startDate, periodicity, billedPeriods)),
        pausedAt: demo.status === "PAUSED" ? new Date(`${pausedOn}T09:00:00Z`) : null,
        endDate: demo.status === "CANCELLED" ? isoToDbDate(endDate) : null,
        amountCents: periodAmount(rows),
        searchText: normalizeSearchText(`${data.label} ${client.displayName}`),
        createdById: admin?.id,
        updatedById: admin?.id,
        items: { create: rows },
      },
    });
    created += 1;
  }
  console.log(`✓ ${created} abonnements de démonstration créés.`);
}

async function main() {
  await seedClients();
  await seedQuotes();
  await seedInvoices();
  await seedSubscriptions();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
