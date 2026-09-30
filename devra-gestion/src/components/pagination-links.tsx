import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { withQuery, type QueryValues } from "@/lib/url";

/** Pagination simple : précédent / suivant, avec la position courante. */
export function PaginationLinks({
  pathname,
  query,
  page,
  pageCount,
}: {
  pathname: string;
  query: QueryValues;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (target: number) =>
    withQuery(pathname, query, { page: target > 1 ? target : undefined });
  return (
    <nav className="flex items-center justify-end gap-2" aria-label="Pagination">
      <span className="text-muted-foreground text-sm">
        Page {page} sur {pageCount}
      </span>
      <Button variant="outline" size="icon-sm" asChild={page > 1} disabled={page <= 1}>
        {page > 1 ? (
          <Link href={href(page - 1)} aria-label="Page précédente">
            <ChevronLeftIcon />
          </Link>
        ) : (
          <span aria-label="Page précédente">
            <ChevronLeftIcon />
          </span>
        )}
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        asChild={page < pageCount}
        disabled={page >= pageCount}
      >
        {page < pageCount ? (
          <Link href={href(page + 1)} aria-label="Page suivante">
            <ChevronRightIcon />
          </Link>
        ) : (
          <span aria-label="Page suivante">
            <ChevronRightIcon />
          </span>
        )}
      </Button>
    </nav>
  );
}
