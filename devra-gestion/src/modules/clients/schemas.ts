import { z } from "zod";
import { CANTON_CODES } from "@/domain/cantons";
import { normalizeTags, TAG_MAX_LENGTH, TAGS_MAX_COUNT } from "@/domain/clients";
import { isCountryCode } from "@/domain/countries";

// Longueurs maximales alignées sur la QR-facture (adresse du débiteur, normes SIX).
const text = (max: number) => z.string().trim().max(max, `${max} caractères maximum`);

const clientFields = z.object({
  kind: z.enum(["INDIVIDUAL", "COMPANY"]),
  firstName: text(50),
  lastName: text(50),
  companyName: text(70),
  contactName: text(70),
  street: text(70),
  streetNumber: text(16),
  postalCode: text(16),
  city: text(35),
  canton: z.enum(CANTON_CODES).nullable(),
  country: z.string().trim().toUpperCase().refine(isCountryCode, "Pays invalide"),
  email: z.union([
    z.literal(""),
    z.string().trim().toLowerCase().pipe(z.email("Adresse email invalide")),
  ]),
  phone: text(30),
  website: text(200),
  siteTypeId: z.uuid().nullable(),
  language: z.enum(["FR", "DE"]),
  notes: text(5000),
  tags: z
    .array(z.string().trim().max(TAG_MAX_LENGTH, `${TAG_MAX_LENGTH} caractères maximum par tag`))
    .max(TAGS_MAX_COUNT, `${TAGS_MAX_COUNT} tags maximum`),
});

/**
 * Données d'un client (création, modification, import). Les champs sans objet
 * pour le type choisi sont vidés (ex. raison sociale d'un particulier).
 */
export const clientInputSchema = clientFields
  .superRefine((client, ctx) => {
    if (client.kind === "INDIVIDUAL" && !client.lastName) {
      ctx.addIssue({ code: "custom", path: ["lastName"], message: "Le nom est obligatoire" });
    }
    if (client.kind === "COMPANY" && !client.companyName) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "La raison sociale est obligatoire",
      });
    }
    if (client.country === "CH" && client.postalCode && !/^\d{4}$/.test(client.postalCode)) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: "NPA suisse : 4 chiffres" });
    }
  })
  .transform((client) => ({
    ...client,
    firstName: client.kind === "INDIVIDUAL" ? client.firstName : "",
    lastName: client.kind === "INDIVIDUAL" ? client.lastName : "",
    companyName: client.kind === "COMPANY" ? client.companyName : "",
    contactName: client.kind === "COMPANY" ? client.contactName : "",
    canton: client.country === "CH" ? client.canton : null,
    tags: normalizeTags(client.tags),
  }));

export type ClientInput = z.input<typeof clientInputSchema>;
export type ClientData = z.output<typeof clientInputSchema>;

/** Valeurs d'un formulaire vide (nouveau client). */
export const EMPTY_CLIENT: ClientInput = {
  kind: "INDIVIDUAL",
  firstName: "",
  lastName: "",
  companyName: "",
  contactName: "",
  street: "",
  streetNumber: "",
  postalCode: "",
  city: "",
  canton: null,
  country: "CH",
  email: "",
  phone: "",
  website: "",
  siteTypeId: null,
  language: "FR",
  notes: "",
  tags: [],
};

const idSchema = z.uuid("Identifiant invalide");

export const createClientSchema = z.object({ client: clientInputSchema });

/** Modification : la version lue sert à détecter une modification concurrente. */
export const updateClientSchema = z.object({
  id: idSchema,
  version: z.number().int().nonnegative(),
  client: clientInputSchema,
});

export const clientIdSchema = z.object({ id: idSchema });

// ---------------------------------------------------------------------------
// Liste : recherche, filtres, tri (paramètres d'URL)
// ---------------------------------------------------------------------------

export const CLIENT_SORTS = {
  nom: { label: "Nom (A → Z)" },
  "-nom": { label: "Nom (Z → A)" },
  recent: { label: "Plus récents" },
  ancien: { label: "Plus anciens" },
  localite: { label: "Localité" },
} as const;
export type ClientSort = keyof typeof CLIENT_SORTS;

export const CLIENT_STATUS_FILTERS = {
  actifs: "Actifs",
  archives: "Archivés",
  tous: "Tous",
} as const;

const optionalParam = <T extends z.ZodType>(schema: T) =>
  z
    .preprocess((v) => (Array.isArray(v) ? v[0] : v) || undefined, schema.optional())
    .catch(undefined);

/** Paramètres d'URL de la liste. Une valeur invalide est simplement ignorée. */
export const clientListParamsSchema = z.object({
  q: optionalParam(z.string().trim().max(100)),
  type: optionalParam(z.enum(["particulier", "entreprise"])),
  canton: optionalParam(z.enum(CANTON_CODES)),
  site: optionalParam(z.uuid()),
  tag: optionalParam(z.string().max(TAG_MAX_LENGTH)),
  statut: optionalParam(z.enum(["actifs", "archives", "tous"])),
  tri: optionalParam(z.enum(Object.keys(CLIENT_SORTS) as [ClientSort, ...ClientSort[]])),
  page: optionalParam(z.coerce.number().int().min(1).max(10_000)),
});

export type ClientListParams = z.output<typeof clientListParamsSchema>;
