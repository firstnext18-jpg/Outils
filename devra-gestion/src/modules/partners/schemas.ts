import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { MAX_UNIT_PRICE_CENTS, parseChfInput } from "@/domain/money";
import { PARTNER_KINDS } from "@/domain/partners";

const id = z.uuid("Identifiant invalide");

/** Mouvement d'un associé : montant positif en CHF, le sens est donné par la sorte. */
export const partnerMovementInputSchema = z
  .object({
    partnerId: z.string().min(1, "Choisissez l'associé"),
    kind: z.enum(PARTNER_KINDS, "Choisissez le type de mouvement"),
    date: z.string().refine(isValidIsoDate, "Date invalide"),
    amount: z.string(),
    description: z.string().trim().max(200, "200 caractères maximum"),
    notes: z.string().trim().max(2000, "2000 caractères maximum"),
  })
  .superRefine((movement, ctx) => {
    const cents = parseChfInput(movement.amount);
    if (cents === null || cents <= 0 || cents > MAX_UNIT_PRICE_CENTS) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Montant invalide" });
    }
  })
  .transform(({ amount, ...movement }) => ({
    ...movement,
    amountCents: parseChfInput(amount) ?? 0,
  }));
export type PartnerMovementInput = z.input<typeof partnerMovementInputSchema>;
export type PartnerMovementData = z.output<typeof partnerMovementInputSchema>;

export const updatePartnerMovementSchema = z.object({ id, movement: partnerMovementInputSchema });
export const partnerMovementIdSchema = z.object({ id });
