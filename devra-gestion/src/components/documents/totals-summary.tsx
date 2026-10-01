import { PERIODICITY_UNIT } from "@/domain/catalog";
import { formatPercent } from "@/domain/percent";
import type { Discount, DocumentTotals } from "@/domain/totals";
import { UNIT_LABELS } from "@/domain/units";
import { formatChf } from "@/lib/format";
import { cn } from "@/lib/utils";

function Row({
  label,
  cents,
  strong,
  muted,
}: {
  label: React.ReactNode;
  cents: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 text-sm",
        strong && "text-base font-semibold",
        muted && "text-muted-foreground",
      )}
    >
      <dt>{label}</dt>
      <dd className="whitespace-nowrap tabular-nums">{formatChf(cents)}</dd>
    </div>
  );
}

/** Récapitulatif des montants d'un devis ou d'une facture (écran). */
export function TotalsSummary({
  totals,
  globalDiscount,
  deposit,
  vatEnabled,
  deductions = [],
}: {
  totals: DocumentTotals;
  globalDiscount: Discount;
  deposit: Discount;
  vatEnabled: boolean;
  /** Facture finale : acomptes facturés, déduits du total. */
  deductions?: { number: string; amountCents: number }[];
}) {
  const { oneTime } = totals;
  const hasOneTime = oneTime.subtotalCents > 0 || totals.recurring.length === 0;
  return (
    <div className="space-y-4">
      {hasOneTime && (
        <dl className="space-y-1.5">
          {(oneTime.discountCents > 0 || oneTime.vat.length > 0 || oneTime.roundingCents !== 0) && (
            <Row label="Sous-total" cents={oneTime.subtotalCents} />
          )}
          {oneTime.discountCents > 0 && (
            <Row
              label={`Remise${globalDiscount?.type === "PERCENT" ? ` (${formatPercent(globalDiscount.value)})` : ""}`}
              cents={-oneTime.discountCents}
            />
          )}
          {oneTime.vat.map((vat) => (
            <Row
              key={vat.rateBps}
              label={`TVA ${formatPercent(vat.rateBps)}`}
              cents={vat.vatCents}
            />
          ))}
          {oneTime.roundingCents !== 0 && (
            <Row label="Arrondi" cents={oneTime.roundingCents} muted />
          )}
          <div className="border-t pt-1.5">
            <Row label="Total" cents={oneTime.totalCents} strong />
          </div>
          {deductions.map((deduction) => (
            <Row
              key={deduction.number}
              label={`Acompte facturé (${deduction.number})`}
              cents={-deduction.amountCents}
            />
          ))}
          {deductions.length > 0 && (
            <div className="border-t pt-1.5">
              <Row
                label="Montant à payer"
                cents={oneTime.totalCents - deductions.reduce((sum, d) => sum + d.amountCents, 0)}
                strong
              />
            </div>
          )}
          {!vatEnabled && <p className="text-muted-foreground text-xs">Non soumis à la TVA</p>}
        </dl>
      )}
      {totals.recurring.length > 0 && (
        <dl className="bg-muted/60 space-y-1.5 rounded-md p-3">
          <p className="text-muted-foreground text-xs font-medium uppercase">Montants récurrents</p>
          {totals.recurring.map((recurring) => (
            <Row
              key={recurring.periodicity}
              label={`Par ${UNIT_LABELS[PERIODICITY_UNIT[recurring.periodicity]].FR.one}`}
              cents={recurring.totalCents}
              strong
            />
          ))}
        </dl>
      )}
      {totals.depositCents > 0 && (
        <dl>
          <Row
            label={`Acompte à la commande${deposit?.type === "PERCENT" ? ` (${formatPercent(deposit.value)})` : ""}`}
            cents={totals.depositCents}
          />
        </dl>
      )}
    </div>
  );
}
