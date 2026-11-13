import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { RenewalLine, renewalsOf, SiteStatusBadge } from "@/components/sites/site-status";
import { todayIso } from "@/domain/dates";
import type { SiteRow } from "@/modules/sites/service";

/** Liste des sites : état, adresse, prochaine échéance. */
export function SiteList({
  sites,
  showClient = true,
  soonDays,
}: {
  sites: SiteRow[];
  showClient?: boolean;
  soonDays: number;
}) {
  const today = todayIso();
  return (
    <ul className="divide-y rounded-md border" aria-label="Sites">
      {sites.map((site) => {
        const next = renewalsOf(site, today)[0];
        return (
          <li key={site.id}>
            <Link
              href={`/sites/${site.id}`}
              className="hover:bg-muted/50 flex items-center gap-4 p-3 text-sm transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{site.name}</span>
                  {showClient && (
                    <span className="text-muted-foreground">{site.client.displayName}</span>
                  )}
                  <SiteStatusBadge site={site} />
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {site.url.replace(/^https?:\/\//, "")}
                  {site.monitor && site.status === "DOWN" && site.lastError
                    ? ` · ${site.lastError}`
                    : ""}
                </div>
              </div>
              <div className="text-muted-foreground hidden text-right text-xs sm:block">
                {next ? <RenewalLine renewal={next} soonDays={soonDays} /> : "Aucune échéance"}
              </div>
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
