import { Badge } from "@/components/ui/badge";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { siteRenewals, type Renewal } from "@/domain/sites";
import { cn } from "@/lib/utils";

type StatusSite = { monitor: boolean; status: "UNKNOWN" | "UP" | "DOWN" };

/** État de surveillance : en ligne, hors ligne, pas encore vérifié ou non surveillé. */
export function SiteStatusBadge({ site }: { site: StatusSite }) {
  if (!site.monitor) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Non surveillé
      </Badge>
    );
  }
  switch (site.status) {
    case "UP":
      return (
        <Badge variant="outline" className="bg-success/15 text-success border-transparent">
          En ligne
        </Badge>
      );
    case "DOWN":
      return (
        <Badge variant="outline" className="bg-destructive/15 text-destructive border-transparent">
          Hors ligne
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground border-dashed">
          Pas encore vérifié
        </Badge>
      );
  }
}

type DatedSite = {
  domainExpiresAt: Date | null;
  hostingRenewsAt: Date | null;
  sslExpiresAt: Date | null;
};

/** Échéances d'un site (dates de la base → dates ISO). */
export function renewalsOf(site: DatedSite, today: string): Renewal[] {
  return siteRenewals(
    {
      domainExpiresAt: site.domainExpiresAt ? dbDateToIso(site.domainExpiresAt) : null,
      hostingRenewsAt: site.hostingRenewsAt ? dbDateToIso(site.hostingRenewsAt) : null,
      sslExpiresAt: site.sslExpiresAt ? site.sslExpiresAt.toISOString().slice(0, 10) : null,
    },
    today,
  );
}

/** « Domaine · 01.03.2027 (dans 12 jours) », en couleur quand l'échéance approche. */
export function RenewalLine({ renewal, soonDays }: { renewal: Renewal; soonDays: number }) {
  const late = renewal.days < 0;
  const soon = !late && renewal.days <= soonDays;
  return (
    <span className={cn(late && "text-destructive", soon && "text-warning font-medium")}>
      {renewal.label} · {formatIsoDate(renewal.date)}
      {late
        ? " (dépassé)"
        : soon
          ? renewal.days === 0
            ? " (aujourd'hui)"
            : ` (dans ${renewal.days} jour${renewal.days > 1 ? "s" : ""})`
          : ""}
    </span>
  );
}
