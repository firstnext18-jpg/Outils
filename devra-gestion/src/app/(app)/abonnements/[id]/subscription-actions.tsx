"use client";

import {
  EllipsisIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SubscriptionStatus } from "@/domain/subscriptions";
import {
  cancelSubscriptionAction,
  deleteSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
} from "@/modules/subscriptions/actions";

type Dialog = "cancel" | "delete" | null;

export function SubscriptionActions({
  subscription,
}: {
  subscription: { id: string; label: string; status: SubscriptionStatus; invoiced: boolean };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);

  function run(
    action: (input: { id: string }) => Promise<{ ok: true } | { ok: false; error: string }>,
    message: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await action({ id: subscription.id });
      setDialog(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message);
      after?.();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {subscription.status !== "CANCELLED" && (
        <Button asChild variant="outline">
          <Link href={`/abonnements/${subscription.id}/modifier`}>
            <PencilIcon /> Modifier
          </Link>
        </Button>
      )}
      {subscription.status === "ACTIVE" && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(pauseSubscriptionAction, "Abonnement mis en pause.")}
        >
          <PauseIcon /> Mettre en pause
        </Button>
      )}
      {subscription.status === "PAUSED" && (
        <Button
          disabled={pending}
          onClick={() => run(resumeSubscriptionAction, "Abonnement repris.")}
        >
          <PlayIcon /> Reprendre
        </Button>
      )}
      {subscription.status !== "CANCELLED" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Autres actions" disabled={pending}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
              <XCircleIcon /> Résilier
            </DropdownMenuItem>
            {!subscription.invoiced && (
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                <Trash2Icon /> Supprimer
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "cancel" ? "Résilier l'abonnement ?" : "Supprimer l'abonnement ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "cancel"
                ? `« ${subscription.label} » ne sera plus facturé. Les factures déjà générées restent inchangées. Cette action est définitive.`
                : `« ${subscription.label} » n'a encore jamais été facturé : il sera définitivement supprimé.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() =>
                dialog === "cancel"
                  ? run(cancelSubscriptionAction, "Abonnement résilié.")
                  : run(deleteSubscriptionAction, "Abonnement supprimé.", () =>
                      router.replace("/abonnements"),
                    )
              }
            >
              {dialog === "cancel" ? "Résilier" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
