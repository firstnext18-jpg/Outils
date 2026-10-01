import { PERIODICITY_LABELS } from "@/domain/catalog";
import { formatPercent } from "@/domain/percent";
import { formatQuantity } from "@/domain/quantity";
import type { DiscountType } from "@/domain/totals";
import { unitLabel, type UnitCode } from "@/domain/units";
import { formatChf } from "@/lib/format";

export type DisplayLine = {
  id: string;
  lineType: "FLAT" | "HOURLY" | "EXTRA" | "SUBSCRIPTION";
  periodicity: "MONTHLY" | "QUARTERLY" | "YEARLY" | null;
  label: string;
  description: string;
  quantityMilli: number;
  unit: UnitCode;
  unitPriceCents: number;
  discountType: DiscountType | null;
  discountValue: number;
  netCents: number;
};

function discountLabel(line: DisplayLine) {
  if (!line.discountType || line.discountValue <= 0) return "";
  return line.discountType === "PERCENT"
    ? formatPercent(line.discountValue)
    : formatChf(line.discountValue);
}

function Rows({ lines, offset }: { lines: DisplayLine[]; offset: number }) {
  return lines.map((line, i) => (
    <tr key={line.id} className="border-b align-top last:border-0">
      <td className="text-muted-foreground py-2 pr-2 tabular-nums">{offset + i + 1}</td>
      <td className="py-2 pr-4">
        <div className="font-medium">{line.label}</div>
        {line.description && (
          <div className="text-muted-foreground text-sm whitespace-pre-wrap">
            {line.description}
          </div>
        )}
        {/* Sur téléphone, les colonnes de détail sont regroupées sous la désignation. */}
        <div className="text-muted-foreground text-sm sm:hidden">
          {formatQuantity(line.quantityMilli)} {unitLabel(line.unit, "FR", line.quantityMilli)} ×{" "}
          {formatChf(line.unitPriceCents)}
          {discountLabel(line) && ` − ${discountLabel(line)}`}
        </div>
      </td>
      <td className="hidden py-2 pr-4 text-right whitespace-nowrap tabular-nums sm:table-cell">
        {formatQuantity(line.quantityMilli)} {unitLabel(line.unit, "FR", line.quantityMilli)}
      </td>
      <td className="hidden py-2 pr-4 text-right whitespace-nowrap tabular-nums sm:table-cell">
        {formatChf(line.unitPriceCents)}
      </td>
      <td className="hidden py-2 pr-4 text-right whitespace-nowrap tabular-nums sm:table-cell">
        {discountLabel(line)}
      </td>
      <td className="py-2 text-right font-medium whitespace-nowrap tabular-nums">
        {formatChf(line.netCents)}
      </td>
    </tr>
  ));
}

/**
 * Lignes d'un devis ou d'une facture (lecture seule). Sur un devis, les
 * abonnements sont regroupés à part ; sur une facture, tout est dû.
 */
export function LinesTable({
  lines,
  separateRecurring = true,
}: {
  lines: DisplayLine[];
  separateRecurring?: boolean;
}) {
  const isRecurring = (line: DisplayLine) => separateRecurring && line.lineType === "SUBSCRIPTION";
  const oneTime = lines.filter((line) => !isRecurring(line));
  const recurring = lines.filter(isRecurring);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs">
            <th className="w-8 py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-4 font-medium">Désignation</th>
            <th className="hidden py-2 pr-4 text-right font-medium sm:table-cell">Quantité</th>
            <th className="hidden py-2 pr-4 text-right font-medium sm:table-cell">Prix unit.</th>
            <th className="hidden py-2 pr-4 text-right font-medium sm:table-cell">Remise</th>
            <th className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          <Rows lines={oneTime} offset={0} />
          {recurring.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground pt-4 pb-1 text-xs font-medium uppercase"
                >
                  Abonnements
                  {" · "}
                  {[
                    ...new Set(
                      recurring.map(
                        (l) => l.periodicity && PERIODICITY_LABELS[l.periodicity].toLowerCase(),
                      ),
                    ),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </td>
              </tr>
              <Rows lines={recurring} offset={oneTime.length} />
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
