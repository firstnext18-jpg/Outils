import "server-only";
import { formatDocumentNumber } from "@/domain/numbering";
import { todayIso, yearOf } from "@/domain/dates";
import { UserError } from "@/server/action";
import { db, type Tx } from "@/server/db";
import { getSettings } from "@/modules/settings/service";

type Kind = "QUOTE" | "INVOICE";

/** Dernier numéro attribué cette année (0 si aucun). */
async function lastValue(client: Tx | typeof db, kind: Kind, year: number) {
  const row = await client.numberSequence.findUnique({ where: { kind_year: { kind, year } } });
  return row?.lastValue ?? 0;
}

/** État des compteurs de l'année en cours, pour la page Paramètres. */
export async function currentCounters() {
  const settings = await getSettings();
  const year = yearOf(todayIso());
  const [quote, invoice] = await Promise.all([
    lastValue(db, "QUOTE", year),
    lastValue(db, "INVOICE", year),
  ]);
  const describe = (format: string, last: number) => ({
    last: last > 0 ? formatDocumentNumber(format, year, last) : null,
    next: formatDocumentNumber(format, year, last + 1),
    nextValue: last + 1,
  });
  return {
    year,
    quote: describe(settings.quoteNumberFormat, quote),
    invoice: describe(settings.invoiceNumberFormat, invoice),
  };
}

/**
 * Fixe le prochain numéro de l'année (ex. pour continuer une numérotation
 * commencée dans un autre outil). On ne peut qu'avancer : revenir en arrière
 * attribuerait deux fois le même numéro.
 */
export async function setNextNumber(tx: Tx, kind: Kind, next: number) {
  const year = yearOf(todayIso());
  const last = await lastValue(tx, kind, year);
  if (next === last + 1) return;
  if (next <= last) {
    throw new UserError(
      `Le prochain numéro de ${kind === "QUOTE" ? "devis" : "facture"} doit être supérieur à ${last} (dernier numéro attribué cette année).`,
    );
  }
  await tx.numberSequence.upsert({
    where: { kind_year: { kind, year } },
    create: { kind, year, lastValue: next - 1 },
    update: { lastValue: next - 1 },
  });
}
