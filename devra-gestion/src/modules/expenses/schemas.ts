import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { PAYMENT_METHODS } from "@/domain/invoice-status";
import { MAX_UNIT_PRICE_CENTS, parseChfInput } from "@/domain/money";

const id = z.uuid("Identifiant invalide");

/** Dépense : montant payé TVA comprise (CHF), taux de TVA facultatif (points de base). */
export const expenseInputSchema = z
  .object({
    date: z.string().refine(isValidIsoDate, "Date invalide"),
    supplier: z.string().trim().max(120, "120 caractères maximum"),
    description: z.string().trim().min(1, "Décrivez la dépense").max(200, "200 caractères maximum"),
    categoryId: id.nullable(),
    amount: z.string(),
    vatRateBps: z.number().int().min(1).max(10_000).nullable(),
    method: z.enum(PAYMENT_METHODS),
    clientId: id.nullable(),
    projectId: id.nullable(),
    notes: z.string().trim().max(2000, "2000 caractères maximum"),
  })
  .superRefine((expense, ctx) => {
    const cents = parseChfInput(expense.amount);
    if (cents === null || cents <= 0 || cents > MAX_UNIT_PRICE_CENTS) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Montant invalide" });
    }
  })
  .transform(({ amount, ...expense }) => ({ ...expense, amountCents: parseChfInput(amount) ?? 0 }));
export type ExpenseInput = z.input<typeof expenseInputSchema>;
export type ExpenseData = z.output<typeof expenseInputSchema>;

export const updateExpenseSchema = z.object({ id, expense: expenseInputSchema });
export const expenseIdSchema = z.object({ id });

const optionalParam = <T extends z.ZodType>(schema: T) =>
  z
    .preprocess((v) => (Array.isArray(v) ? v[0] : v) || undefined, schema.optional())
    .catch(undefined);

export const expenseListParamsSchema = z.object({
  du: optionalParam(z.string().refine(isValidIsoDate)),
  au: optionalParam(z.string().refine(isValidIsoDate)),
  categorie: optionalParam(z.uuid()),
  q: optionalParam(z.string().trim().max(100)),
});
export type ExpenseListParams = z.output<typeof expenseListParamsSchema>;
