import { cantonName } from "@/domain/cantons";
import { CLIENT_KIND_LABELS, LANGUAGE_LABELS } from "@/domain/clients";
import { formatDate } from "@/lib/format";

/**
 * Colonnes de l'export des clients. Les intitulés sont reconnus tels quels par
 * l'import : un fichier exporté peut être réimporté sans correspondance manuelle.
 */
export const CLIENT_EXPORT_HEADERS = [
  "Type",
  "Nom affiché",
  "Prénom",
  "Nom",
  "Raison sociale",
  "Personne de contact",
  "Rue",
  "Numéro",
  "NPA",
  "Localité",
  "Canton",
  "Pays",
  "Email",
  "Téléphone",
  "Site internet",
  "Type de site",
  "Langue",
  "Tags",
  "Notes",
  "Archivé",
  "Créé le",
];

type ExportableClient = {
  kind: "INDIVIDUAL" | "COMPANY";
  displayName: string;
  firstName: string;
  lastName: string;
  companyName: string;
  contactName: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  canton: Parameters<typeof cantonName>[0] | null;
  country: string;
  email: string;
  phone: string;
  website: string;
  siteType: { name: string } | null;
  language: "FR" | "DE";
  tags: string[];
  notes: string;
  archivedAt: Date | null;
  createdAt: Date;
};

export function clientExportRow(client: ExportableClient): string[] {
  return [
    CLIENT_KIND_LABELS[client.kind],
    client.displayName,
    client.firstName,
    client.lastName,
    client.companyName,
    client.contactName,
    client.street,
    client.streetNumber,
    client.postalCode,
    client.city,
    client.canton ? cantonName(client.canton) : "",
    client.country,
    client.email,
    client.phone,
    client.website,
    client.siteType?.name ?? "",
    LANGUAGE_LABELS[client.language],
    client.tags.join(", "),
    client.notes,
    client.archivedAt ? formatDate(client.archivedAt) : "",
    formatDate(client.createdAt),
  ];
}
