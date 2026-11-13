import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { parseDuration } from "@/domain/time";

const id = z.uuid("Identifiant invalide");

/** Saisie de temps : durée « 1:30 », « 1.5 », « 45 min »… */
export const timeEntryInputSchema = z
  .object({
    clientId: z.uuid("Choisissez un client"),
    projectId: id.nullable(),
    date: z.string().refine(isValidIsoDate, "Date invalide"),
    duration: z.string().trim(),
    description: z.string().trim().max(500, "500 caractères maximum"),
    billable: z.boolean(),
  })
  .superRefine((entry, ctx) => {
    if (parseDuration(entry.duration) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["duration"],
        message: "Durée invalide (ex. 1:30, 1.5 ou 45 min ; 24 h au plus)",
      });
    }
  })
  .transform(({ duration, ...entry }) => ({ ...entry, minutes: parseDuration(duration) ?? 0 }));
export type TimeEntryInput = z.input<typeof timeEntryInputSchema>;
export type TimeEntryData = z.output<typeof timeEntryInputSchema>;

export const createTimeEntrySchema = z.object({ entry: timeEntryInputSchema });
export const updateTimeEntrySchema = z.object({ id, entry: timeEntryInputSchema });
export const timeEntryIdSchema = z.object({ id });

export const startTimerSchema = z.object({
  clientId: z.uuid("Choisissez un client"),
  projectId: id.nullable(),
  description: z.string().trim().max(500, "500 caractères maximum"),
});

export const billTimeSchema = z.object({ clientId: id });

/** Filtres de la page « Temps » (paramètres d'URL). */
const optionalParam = <T extends z.ZodType>(schema: T) =>
  z
    .preprocess((v) => (Array.isArray(v) ? v[0] : v) || undefined, schema.optional())
    .catch(undefined);

export const timeListParamsSchema = z.object({
  du: optionalParam(z.string().refine(isValidIsoDate)),
  au: optionalParam(z.string().refine(isValidIsoDate)),
  client: optionalParam(z.uuid()),
  projet: optionalParam(z.uuid()),
  utilisateur: optionalParam(z.uuid()),
  facture: optionalParam(z.enum(["oui", "non"])),
});
export type TimeListParams = z.output<typeof timeListParamsSchema>;
