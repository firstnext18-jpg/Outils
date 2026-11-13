import type { Metadata } from "next";
import { GlobeIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SiteList } from "@/components/sites/site-list";
import { renewalsOf } from "@/components/sites/site-status";
import { Button } from "@/components/ui/button";
import { todayIso } from "@/domain/dates";
import { canEdit } from "@/domain/roles";
import { cn } from "@/lib/utils";
import { getSettings } from "@/modules/settings/service";
import { listSites } from "@/modules/sites/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Sites" };

const FILTERS = {
  tous: "Tous",
  "hors-ligne": "Hors ligne",
  echeances: "Échéances proches",
} as const;

export default async function SitesPage({ searchParams }: PageProps<"/sites">) {
  const user = await requireUser();
  const { filtre } = await searchParams;
  const filter =
    typeof filtre === "string" && filtre in FILTERS ? (filtre as keyof typeof FILTERS) : "tous";
  const [all, settings] = await Promise.all([listSites(), getSettings()]);
  const today = todayIso();
  const soon = (site: (typeof all)[number]) =>
    renewalsOf(site, today).some((r) => r.days <= settings.renewalReminderDays);
  const sites =
    filter === "hors-ligne"
      ? all.filter((s) => s.monitor && s.status === "DOWN")
      : filter === "echeances"
        ? all.filter(soon)
        : all;
  const counts = {
    tous: all.length,
    "hors-ligne": all.filter((s) => s.monitor && s.status === "DOWN").length,
    echeances: all.filter(soon).length,
  };

  return (
    <>
      <PageHeader
        title="Sites"
        description="Sites des clients : surveillance, domaines, hébergements et certificats."
        actions={
          canEdit(user.role) && (
            <Button asChild>
              <Link href="/sites/nouveau">
                <PlusIcon /> Nouveau site
              </Link>
            </Button>
          )
        }
      />
      <nav className="flex flex-wrap gap-1" aria-label="Filtrer les sites">
        {Object.entries(FILTERS).map(([key, label]) => (
          <Link
            key={key}
            href={key === "tous" ? "/sites" : `/sites?filtre=${key}`}
            aria-current={filter === key ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              filter === key ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {label} ({counts[key as keyof typeof counts]})
          </Link>
        ))}
      </nav>
      {sites.length > 0 ? (
        <SiteList sites={sites} soonDays={settings.renewalReminderDays} />
      ) : (
        <EmptyState
          icon={GlobeIcon}
          title={filter === "tous" ? "Aucun site" : "Rien à signaler"}
          description={
            filter === "tous"
              ? "Ajoutez les sites de vos clients pour être alerté s'ils tombent et avant chaque renouvellement."
              : "Aucun site dans cette catégorie."
          }
        />
      )}
    </>
  );
}
