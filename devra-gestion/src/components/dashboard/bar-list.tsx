import Link from "next/link";
import { cn } from "@/lib/utils";

export type BarRow = {
  key: string;
  label: string;
  href?: string;
  /** Valeur affichée (ex. « CHF 1'250.00 »). */
  value: string;
  detail?: string;
  /** Barres, de 0 à 1 (part de la plus grande valeur). */
  bars: { share: number; tone: "chart-1" | "chart-2" }[];
};

/**
 * Liste avec barres horizontales : lisible sur téléphone, accessible (le texte
 * porte toute l'information, les barres ne font que l'illustrer).
 */
export function BarList({ rows, empty, label }: { rows: BarRow[]; empty: string; label: string }) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <ul className="space-y-3 text-sm" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              {row.href ? (
                <Link href={row.href} className="font-medium hover:underline">
                  {row.label}
                </Link>
              ) : (
                <span className="font-medium">{row.label}</span>
              )}
              {row.detail && <span className="text-muted-foreground"> · {row.detail}</span>}
            </span>
            <span className="shrink-0 tabular-nums">{row.value}</span>
          </div>
          <div className="space-y-0.5" aria-hidden>
            {row.bars.map((bar, index) => (
              <div key={index} className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full",
                    bar.tone === "chart-1" ? "bg-chart-1" : "bg-chart-2",
                  )}
                  style={{ width: `${Math.round(bar.share * 1000) / 10}%` }}
                />
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Légende des couleurs des barres et du graphique. */
export function ChartLegend({
  items,
}: {
  items: { label: string; tone: "chart-1" | "chart-2" }[];
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "size-2.5 rounded-sm",
              item.tone === "chart-1" ? "bg-chart-1" : "bg-chart-2",
            )}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
