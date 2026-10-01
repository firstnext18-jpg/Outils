import type { Metadata } from "next";
import Link from "next/link";
import { JournalToolbar } from "@/app/(app)/parametres/journal/journal-toolbar";
import { PaginationLinks } from "@/components/pagination-links";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { activityActor } from "@/domain/activity";
import { journalSentence } from "@/domain/journal";
import { formatDateTime } from "@/lib/format";
import { journalParamsSchema, journalUsers, listJournal } from "@/modules/journal/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Journal d'activité" };

export default async function JournalPage({ searchParams }: PageProps<"/parametres/journal">) {
  await requireRole("ADMIN");
  const params = journalParamsSchema.parse(await searchParams);
  const [journal, users] = await Promise.all([listJournal(params), journalUsers()]);
  const { page: _page, ...query } = params;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal d&apos;activité</CardTitle>
        <CardDescription>
          Qui a fait quoi, et quand : documents, paiements, clients, utilisateurs, paramètres et
          exports. « Système » désigne les tâches automatiques.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <JournalToolbar users={users} />
        <p className="text-muted-foreground text-sm">
          {journal.total === 0
            ? "Aucune activité ne correspond."
            : `${journal.total} action${journal.total > 1 ? "s" : ""}`}
        </p>
        {journal.entries.length > 0 && (
          <ol className="divide-y text-sm" aria-label="Activités">
            {journal.entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
                <time
                  dateTime={entry.createdAt.toISOString()}
                  className="text-muted-foreground shrink-0 tabular-nums sm:w-36"
                >
                  {formatDateTime(entry.createdAt)}
                </time>
                <span className="min-w-0">
                  <span className="font-medium">{activityActor(entry.user, entry.details)}</span>{" "}
                  {journalSentence(entry)}
                  {entry.href && (
                    <>
                      {" · "}
                      <Link href={entry.href} className="text-muted-foreground hover:underline">
                        Ouvrir
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
        <PaginationLinks
          pathname="/parametres/journal"
          query={query}
          page={journal.page}
          pageCount={journal.pageCount}
        />
      </CardContent>
    </Card>
  );
}
