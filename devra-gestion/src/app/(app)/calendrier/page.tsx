import type { Metadata } from "next";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { CalendarFeedCard } from "@/app/(app)/calendrier/calendar-feed-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  CALENDAR_KIND_LABELS,
  CALENDAR_KINDS,
  monthGrid,
  parseMonth,
  shiftMonth,
  type CalendarItem,
  type CalendarKind,
} from "@/domain/calendar";
import { formatIsoDate, todayIso } from "@/domain/dates";
import { cn } from "@/lib/utils";
import { calendarItems, hasCalendarFeed } from "@/modules/calendar/service";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Calendrier" };

const DOT: Record<CalendarKind, string> = {
  invoice: "bg-destructive",
  quote: "bg-primary",
  subscription: "bg-success",
  project: "bg-warning",
  domain: "bg-sky-500",
  hosting: "bg-violet-500",
  ssl: "bg-zinc-400",
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function monthTitle(firstDay: string): string {
  const label = new Date(`${firstDay}T12:00:00Z`).toLocaleDateString("fr-CH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function EventLink({ item, compact = false }: { item: CalendarItem; compact?: boolean }) {
  return (
    <Link
      href={item.href}
      title={[item.title, item.detail].filter(Boolean).join(" · ")}
      className={cn(
        "hover:bg-muted flex items-start gap-1.5 rounded px-1 py-0.5",
        compact ? "text-xs" : "text-sm",
      )}
    >
      <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[item.kind])} />
      <span className={cn("min-w-0", compact && "line-clamp-2")}>
        {item.title}
        {!compact && item.detail && <span className="text-muted-foreground"> · {item.detail}</span>}
      </span>
    </Link>
  );
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendrier">) {
  const user = await requireUser();
  const { mois } = await searchParams;
  const today = todayIso();
  const firstDay = parseMonth(mois) ?? `${today.slice(0, 7)}-01`;
  const days = monthGrid(firstDay);
  const [items, feedActive] = await Promise.all([
    calendarItems(days[0]!, days.at(-1)!),
    hasCalendarFeed(user.id),
  ]);
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
  const month = firstDay.slice(0, 7);
  const monthItems = items.filter((item) => item.date.startsWith(month));

  return (
    <>
      <PageHeader
        title="Calendrier"
        description="Échéances des factures et des devis, abonnements, projets et renouvellements des sites."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Mois précédent">
            <Link href={`/calendrier?mois=${shiftMonth(firstDay, -1).slice(0, 7)}`}>
              <ChevronLeftIcon />
            </Link>
          </Button>
          <h2 className="min-w-40 text-center text-lg font-semibold">{monthTitle(firstDay)}</h2>
          <Button asChild variant="outline" size="icon" aria-label="Mois suivant">
            <Link href={`/calendrier?mois=${shiftMonth(firstDay, 1).slice(0, 7)}`}>
              <ChevronRightIcon />
            </Link>
          </Button>
          {month !== today.slice(0, 7) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/calendrier">Aujourd&apos;hui</Link>
            </Button>
          )}
        </div>
        <ul
          className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs"
          aria-label="Légende"
        >
          {CALENDAR_KINDS.map((kind) => (
            <li key={kind} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 rounded-full", DOT[kind])} />
              {CALENDAR_KIND_LABELS[kind]}
            </li>
          ))}
        </ul>
      </div>

      {/* Grand écran : grille du mois */}
      <div className="hidden overflow-hidden rounded-md border md:block">
        <div className="bg-muted/50 grid grid-cols-7 border-b text-xs font-medium">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-1.5">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dayItems = byDay.get(day) ?? [];
            const outside = !day.startsWith(month);
            return (
              <div
                key={day}
                className={cn(
                  "min-h-28 space-y-0.5 border-b p-1",
                  index % 7 !== 6 && "border-r",
                  outside && "bg-muted/30 text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "px-1 text-xs tabular-nums",
                    day === today &&
                      "bg-primary text-primary-foreground inline-block rounded-sm font-semibold",
                  )}
                >
                  {Number(day.slice(8))}
                </div>
                {dayItems.slice(0, 4).map((item) => (
                  <EventLink key={item.uid} item={item} compact />
                ))}
                {dayItems.length > 4 && (
                  <div className="text-muted-foreground px-1 text-xs">
                    +{dayItems.length - 4} autres
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Téléphone : liste des jours du mois */}
      <div className="space-y-3 md:hidden">
        {monthItems.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune échéance ce mois-ci.</p>
        ) : (
          [...new Set(monthItems.map((item) => item.date))].map((day) => (
            <section key={day} className="space-y-1">
              <h3 className={cn("text-sm font-medium", day === today && "text-primary")}>
                {formatIsoDate(day)}
              </h3>
              {(byDay.get(day) ?? []).map((item) => (
                <EventLink key={item.uid} item={item} />
              ))}
            </section>
          ))
        )}
      </div>

      <CalendarFeedCard active={feedActive} />
    </>
  );
}
