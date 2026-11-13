import { fillLabel } from "@/i18n/documents";
import type { PortalTexts } from "@/i18n/portal";
import { cn } from "@/lib/utils";

type PortalSite = {
  id: string;
  name: string;
  url: string;
  status: "UNKNOWN" | "UP" | "DOWN";
  uptime30: number;
};

/** État des sites du client (ceux que l'équipe a choisi de montrer). */
export function PortalSiteStatusList({
  sites,
  t,
  language,
}: {
  sites: PortalSite[];
  t: PortalTexts;
  language: "FR" | "DE";
}) {
  const percent = new Intl.NumberFormat(language === "DE" ? "de-CH" : "fr-CH", {
    maximumFractionDigits: 1,
  });
  return (
    <ul className="divide-y" aria-label={t.yourSites}>
      {sites.map((site) => (
        <li
          key={site.id}
          className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
        >
          <div className="min-w-0">
            <div className="font-medium">{site.name}</div>
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground text-xs hover:underline"
            >
              {site.url.replace(/^https?:\/\//, "")}
            </a>
          </div>
          <div className="text-right">
            <div
              className={cn(
                "flex items-center justify-end gap-2 font-medium",
                site.status === "UP" && "text-success",
                site.status === "DOWN" && "text-destructive",
                site.status === "UNKNOWN" && "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  site.status === "UP" && "bg-success",
                  site.status === "DOWN" && "bg-destructive",
                  site.status === "UNKNOWN" && "bg-muted-foreground",
                )}
              />
              {site.status === "UP"
                ? t.siteUp
                : site.status === "DOWN"
                  ? t.siteDown
                  : t.siteUnknown}
            </div>
            {site.status === "DOWN" ? (
              <div className="text-muted-foreground text-xs">{t.siteDownHelp}</div>
            ) : (
              site.status === "UP" && (
                <div className="text-muted-foreground text-xs tabular-nums">
                  {fillLabel(t.siteUptime, { percent: percent.format(site.uptime30) })}
                </div>
              )
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
