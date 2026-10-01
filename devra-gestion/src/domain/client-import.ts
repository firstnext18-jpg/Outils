/**
 * Import de clients depuis un tableau (CSV ou Excel) : correspondance des
 * colonnes et conversion de chaque ligne en données de client. Module pur,
 * testé ; la validation finale est faite par le schéma Zod des clients.
 */
import { parseCanton, type CantonCode } from "@/domain/cantons";
import { splitStreetAndNumber, parseTagList, type ClientKind } from "@/domain/clients";
import { parseCountry } from "@/domain/countries";
import { normalizeKey } from "@/domain/text";

export const IMPORT_FIELDS = [
  {
    key: "kind",
    label: "Type (particulier / entreprise)",
    aliases: ["type", "typeclient", "typedeclient", "categorie", "kind", "art"],
  },
  { key: "firstName", label: "Prénom", aliases: ["prenom", "firstname", "vorname", "givenname"] },
  {
    key: "lastName",
    label: "Nom",
    aliases: ["nom", "name", "lastname", "nachname", "nomdefamille", "surname", "familyname"],
  },
  {
    key: "companyName",
    label: "Raison sociale",
    aliases: [
      "raisonsociale",
      "entreprise",
      "societe",
      "company",
      "firma",
      "firmenname",
      "organisation",
      "unternehmen",
    ],
  },
  {
    key: "contactName",
    label: "Personne de contact",
    aliases: ["personnedecontact", "contact", "kontaktperson", "ansprechpartner", "contactname"],
  },
  {
    key: "street",
    label: "Rue",
    aliases: ["rue", "adresse", "address", "street", "strasse", "adresse1", "addressline1"],
  },
  {
    key: "streetNumber",
    label: "Numéro",
    aliases: ["numero", "no", "n", "nr", "hausnummer", "number", "streetnumber", "num"],
  },
  {
    key: "postalCode",
    label: "NPA",
    aliases: ["npa", "codepostal", "cp", "zip", "zipcode", "plz", "postalcode", "postleitzahl"],
  },
  {
    key: "city",
    label: "Localité",
    aliases: ["localite", "ville", "city", "ort", "commune", "lieu", "town", "ortschaft"],
  },
  { key: "canton", label: "Canton", aliases: ["canton", "kanton"] },
  { key: "country", label: "Pays", aliases: ["pays", "country", "land"] },
  {
    key: "email",
    label: "Email",
    aliases: ["email", "mail", "courriel", "adresseemail", "emailadresse"],
  },
  {
    key: "phone",
    label: "Téléphone",
    aliases: ["telephone", "tel", "phone", "telefon", "mobile", "natel", "portable", "handy"],
  },
  {
    key: "website",
    label: "Site internet",
    aliases: ["siteinternet", "site", "website", "siteweb", "web", "url", "webseite"],
  },
  { key: "siteType", label: "Type de site", aliases: ["typedesite", "typesite", "sitetype"] },
  {
    key: "language",
    label: "Langue",
    aliases: ["langue", "language", "sprache", "languedesdocuments"],
  },
  { key: "tags", label: "Tags", aliases: ["tags", "tag", "etiquettes", "etiquette", "labels"] },
  {
    key: "notes",
    label: "Notes",
    aliases: [
      "notes",
      "note",
      "remarques",
      "remarque",
      "commentaire",
      "commentaires",
      "bemerkungen",
      "comments",
    ],
  },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

/** Pour chaque champ, l'index de la colonne source (absent = champ non importé). */
export type ImportMapping = Partial<Record<ImportFieldKey, number>>;

/**
 * Propose une correspondance à partir des en-têtes du fichier (« Prénom »,
 * « E-mail », « PLZ »…). Chaque colonne n'est utilisée qu'une fois.
 */
export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<number>();
  const keys = headers.map(normalizeKey);
  for (const field of IMPORT_FIELDS) {
    const index = keys.findIndex(
      (key, i) => !used.has(i) && (field.aliases as readonly string[]).includes(key),
    );
    if (index >= 0) {
      mapping[field.key] = index;
      used.add(index);
    }
  }
  return mapping;
}

/** Données d'un client prêtes à être validées par le schéma Zod. */
export type ImportedClientInput = {
  kind: ClientKind;
  firstName: string;
  lastName: string;
  companyName: string;
  contactName: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  canton: CantonCode | null;
  country: string;
  email: string;
  phone: string;
  website: string;
  siteTypeId: string | null;
  language: "FR" | "DE";
  tags: string[];
  notes: string;
};

const KIND_VALUES: Record<string, ClientKind> = {
  entreprise: "COMPANY",
  societe: "COMPANY",
  company: "COMPANY",
  firma: "COMPANY",
  unternehmen: "COMPANY",
  e: "COMPANY",
  particulier: "INDIVIDUAL",
  prive: "INDIVIDUAL",
  individual: "INDIVIDUAL",
  person: "INDIVIDUAL",
  privat: "INDIVIDUAL",
  privatperson: "INDIVIDUAL",
  p: "INDIVIDUAL",
};

const LANGUAGE_VALUES: Record<string, "FR" | "DE"> = {
  fr: "FR",
  francais: "FR",
  french: "FR",
  franzosisch: "FR",
  de: "DE",
  allemand: "DE",
  deutsch: "DE",
  german: "DE",
};

/**
 * Valeur d'une cellule, nettoyée. Une apostrophe placée devant =, +, - ou @
 * (protection contre les formules, ajoutée par notre export CSV) est retirée.
 */
function cell(cells: string[], index: number | undefined): string {
  if (index === undefined) return "";
  const value = (cells[index] ?? "").trim();
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

export function mapImportRow(
  cells: string[],
  mapping: ImportMapping,
  siteTypes: { id: string; name: string }[],
): { input: ImportedClientInput; warnings: string[] } {
  const warnings: string[] = [];
  const get = (key: ImportFieldKey) => cell(cells, mapping[key]);

  const companyName = get("companyName");
  const rawKind = get("kind");
  let kind: ClientKind = companyName ? "COMPANY" : "INDIVIDUAL";
  if (rawKind) {
    const parsed = KIND_VALUES[normalizeKey(rawKind)];
    if (parsed) kind = parsed;
    else
      warnings.push(
        `Type « ${rawKind} » non reconnu : ${kind === "COMPANY" ? "entreprise" : "particulier"} retenu.`,
      );
  }

  let street = get("street");
  let streetNumber = get("streetNumber");
  if (mapping.streetNumber === undefined && street) {
    ({ street, number: streetNumber } = splitStreetAndNumber(street));
  }

  // « CH-1000 » ou « CH 1000 » → « 1000 »
  const postalCode = get("postalCode").replace(/^CH[-\s]?(?=\d{4}$)/i, "");

  const rawCountry = get("country");
  let country = "CH";
  if (rawCountry) {
    const parsed = parseCountry(rawCountry);
    if (parsed) country = parsed;
    else warnings.push(`Pays « ${rawCountry} » non reconnu : Suisse retenue.`);
  }

  const rawCanton = get("canton");
  let canton: CantonCode | null = null;
  if (rawCanton) {
    canton = parseCanton(rawCanton);
    if (!canton) warnings.push(`Canton « ${rawCanton} » non reconnu : ignoré.`);
  }
  if (country !== "CH") canton = null;

  const rawSiteType = get("siteType");
  let siteTypeId: string | null = null;
  if (rawSiteType) {
    const match = siteTypes.find((t) => normalizeKey(t.name) === normalizeKey(rawSiteType));
    if (match) siteTypeId = match.id;
    else warnings.push(`Type de site « ${rawSiteType} » inconnu : ignoré.`);
  }

  const rawLanguage = get("language");
  let language: "FR" | "DE" = "FR";
  if (rawLanguage) {
    const parsed = LANGUAGE_VALUES[normalizeKey(rawLanguage)];
    if (parsed) language = parsed;
    else warnings.push(`Langue « ${rawLanguage} » non reconnue : français retenu.`);
  }

  return {
    input: {
      kind,
      firstName: get("firstName"),
      lastName: get("lastName"),
      companyName,
      contactName: get("contactName"),
      street,
      streetNumber,
      postalCode,
      city: get("city"),
      canton,
      country,
      email: get("email").toLowerCase(),
      phone: get("phone"),
      website: get("website"),
      siteTypeId,
      language,
      tags: parseTagList(get("tags")),
      notes: get("notes"),
    },
    warnings,
  };
}
