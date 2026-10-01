import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeRange,
  PERIOD_KINDS,
  PERIOD_LABELS,
  type DashboardPeriod,
} from "@/domain/dashboard";
import { cn } from "@/lib/utils";

/**
 * Choix de la période (liens, et formulaire GET pour une période
 * personnalisée) : fonctionne sans JavaScript et l'adresse se partage.
 */
export function PeriodFilter({ period }: { period: DashboardPeriod }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <nav aria-label="Période" className="bg-muted inline-flex rounded-lg p-1">
          {PERIOD_KINDS.map((kind) => (
            <Link
              key={kind}
              href={kind === "mois" ? "/" : `/?periode=${kind}`}
              aria-current={period.kind === kind ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                period.kind === kind
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIOD_LABELS[kind]}
            </Link>
          ))}
        </nav>
        <p className="text-muted-foreground text-sm">
          Période : {describeRange(period.current)} · comparaison : {describeRange(period.previous)}
        </p>
      </div>
      {period.kind === "personnalise" && (
        <form method="get" action="/" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="periode" value="personnalise" />
          <div className="space-y-1">
            <Label htmlFor="period-from">Du</Label>
            <Input
              id="period-from"
              name="du"
              type="date"
              defaultValue={period.current.from}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-to">Au</Label>
            <Input id="period-to" name="au" type="date" defaultValue={period.current.to} required />
          </div>
          <Button type="submit" variant="outline">
            Afficher
          </Button>
        </form>
      )}
    </div>
  );
}
