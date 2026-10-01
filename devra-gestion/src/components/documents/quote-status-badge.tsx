import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/domain/quote-status";
import { cn } from "@/lib/utils";

const STYLES: Record<QuoteStatus, string> = {
  DRAFT: "border-dashed bg-transparent text-muted-foreground",
  SENT: "bg-secondary text-secondary-foreground",
  ACCEPTED: "border-transparent bg-success/15 text-success",
  REFUSED: "border-transparent bg-destructive/15 text-destructive",
  EXPIRED: "border-transparent bg-warning/15 text-warning",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[status])}>
      {QUOTE_STATUS_LABELS[status]}
    </Badge>
  );
}
