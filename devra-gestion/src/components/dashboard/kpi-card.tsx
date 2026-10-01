import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { formatChange } from "@/domain/dashboard";
import { cn } from "@/lib/utils";

/** Indicateur : valeur, détail, et éventuellement l'évolution par rapport à la période précédente. */
export function KpiCard({
  title,
  value,
  detail,
  comparison,
  href,
}: {
  title: string;
  value: string;
  detail?: React.ReactNode;
  /** `change` vide : rien à comparer (période précédente à zéro). */
  comparison?: { change: number | null; previous: string };
  href?: string;
}) {
  const content = (
    <Card className={cn("h-full gap-2 py-4", href && "hover:bg-muted/40 transition-colors")}>
      <CardHeader className="px-4">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 px-4">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {comparison && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
            {comparison.change !== null && (
              <span
                className={cn(
                  "inline-flex items-center font-medium",
                  comparison.change > 0.0049 && "text-success",
                  comparison.change < -0.0049 && "text-destructive",
                )}
              >
                {comparison.change > 0.0049 && <ArrowUpRightIcon className="size-3.5" />}
                {comparison.change < -0.0049 && <ArrowDownRightIcon className="size-3.5" />}
                {formatChange(comparison.change)}
              </span>
            )}
            <span>période précédente : {comparison.previous}</span>
          </p>
        )}
        {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl">
      {content}
    </Link>
  ) : (
    content
  );
}
