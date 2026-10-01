import { Badge } from "@/components/ui/badge";
import { INVOICE_STATUS_LABELS, type InvoiceDisplayStatus } from "@/domain/invoice-status";
import { cn } from "@/lib/utils";

const STYLES: Record<InvoiceDisplayStatus, string> = {
  DRAFT: "border-dashed bg-transparent text-muted-foreground",
  SENT: "bg-secondary text-secondary-foreground",
  PARTIALLY_PAID: "border-transparent bg-warning/15 text-warning",
  PAID: "border-transparent bg-success/15 text-success",
  OVERDUE: "border-transparent bg-destructive/15 text-destructive",
  CANCELLED: "bg-transparent text-muted-foreground line-through",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceDisplayStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[status])}>
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}
