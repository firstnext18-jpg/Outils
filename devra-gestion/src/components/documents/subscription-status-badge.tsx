import { Badge } from "@/components/ui/badge";
import { SUBSCRIPTION_STATUS_LABELS, type SubscriptionStatus } from "@/domain/subscriptions";
import { cn } from "@/lib/utils";

const STYLES: Record<SubscriptionStatus, string> = {
  ACTIVE: "border-transparent bg-success/15 text-success",
  PAUSED: "border-transparent bg-warning/15 text-warning",
  CANCELLED: "bg-transparent text-muted-foreground",
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[status])}>
      {SUBSCRIPTION_STATUS_LABELS[status]}
    </Badge>
  );
}
