import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { parseChfInput } from "@/domain/money";

const id = z.uuid("Identifiant invalide");
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidIsoDate(v), "Date invalide")
  .transform((v) => v || null);

export const stepLabelSchema = z
  .string()
  .trim()
  .min(1, "Le nom de l'étape est obligatoire")
  .max(120, "120 caractères maximum");

/** Formulaire d'un projet. Tarif en CHF (vide = tarif par défaut), budget en heures. */
const projectFields = z.object({
  clientId: z.uuid("Choisissez un client"),
  name: z.string().trim().min(1, "Indiquez le nom du projet").max(120, "120 caractères maximum"),
  description: z.string().trim().max(2000, "2000 caractères maximum"),
  startDate: optionalDate,
  dueDate: optionalDate,
  hourlyRate: z.string().trim().max(20),
  budgetHours: z.string().trim().max(10),
  showHoursToClient: z.boolean(),
});

type ProjectFields = z.output<typeof projectFields>;

function checkProject(p: ProjectFields, ctx: z.RefinementCtx) {
  if (p.hourlyRate && parseChfInput(p.hourlyRate) === null) {
    ctx.addIssue({ code: "custom", path: ["hourlyRate"], message: "Montant invalide" });
  }
  if (p.budgetHours && !/^\d{1,5}([.,]\d{1,2})?$/.test(p.budgetHours)) {
    ctx.addIssue({ code: "custom", path: ["budgetHours"], message: "Nombre d'heures invalide" });
  }
  if (p.startDate && p.dueDate && p.dueDate < p.startDate) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Doit être après le début" });
  }
}

function toData<T extends ProjectFields>({ hourlyRate, budgetHours, ...project }: T) {
  return {
    ...project,
    hourlyRateCents: hourlyRate ? parseChfInput(hourlyRate) : null,
    budgetMinutes: budgetHours ? Math.round(Number(budgetHours.replace(",", ".")) * 60) : null,
  };
}

export const projectInputSchema = projectFields
  .extend({ steps: z.array(stepLabelSchema).max(30, "30 étapes maximum") })
  .superRefine(checkProject)
  .transform(toData);
export type ProjectInput = z.input<typeof projectInputSchema>;
export type ProjectData = z.output<typeof projectInputSchema>;

const projectUpdateSchema = projectFields.superRefine(checkProject).transform(toData);
export type ProjectUpdateData = z.output<typeof projectUpdateSchema>;

export const createProjectSchema = z.object({ project: projectInputSchema });
export const updateProjectSchema = z.object({ id, project: projectUpdateSchema });
export const projectIdSchema = z.object({ id });
export const projectStatusSchema = z.object({ id, status: z.enum(["ACTIVE", "PAUSED", "DONE"]) });

export const stepIdSchema = z.object({ id });
export const toggleStepSchema = z.object({ id, done: z.boolean() });
export const addStepSchema = z.object({ projectId: id, label: stepLabelSchema });
export const renameStepSchema = z.object({ id, label: stepLabelSchema });
export const moveStepSchema = z.object({ id, direction: z.enum(["up", "down"]) });
