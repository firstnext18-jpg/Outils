import { formatDocumentNumber } from "@/domain/numbering";
import type { Tx } from "@/server/db";

/**
 * Attribue le prochain numéro d'un document pour l'année donnée.
 *
 * Une seule requête SQL crée le compteur de l'année (à 1) ou l'incrémente, et
 * verrouille la ligne jusqu'à la fin de la transaction : deux utilisateurs qui
 * créent un document au même moment reçoivent deux numéros différents. Si la
 * transaction échoue, l'incrément est annulé avec elle : aucun numéro sauté.
 * À appeler dans la transaction qui crée le document.
 */
export async function allocateDocumentNumber(
  tx: Tx,
  kind: "QUOTE" | "INVOICE",
  year: number,
  format: string,
): Promise<{ number: string; sequence: number }> {
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "number_sequence" ("kind", "year", "lastValue", "updatedAt")
    VALUES (${kind}::"SequenceKind", ${year}, 1, now())
    ON CONFLICT ("kind", "year")
    DO UPDATE SET "lastValue" = "number_sequence"."lastValue" + 1, "updatedAt" = now()
    RETURNING "lastValue"`;
  const sequence = rows[0]!.lastValue;
  return { number: formatDocumentNumber(format, year, sequence), sequence };
}
