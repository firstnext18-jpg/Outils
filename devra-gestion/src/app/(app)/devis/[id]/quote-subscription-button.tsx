"use client";

import { RepeatIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayIso } from "@/domain/dates";
import { createSubscriptionsFromQuoteAction } from "@/modules/subscriptions/actions";

/** Création de l'abonnement (ou des abonnements, un par périodicité) d'un devis accepté. */
export function QuoteSubscriptionButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createSubscriptionsFromQuoteAction({ quoteId, startDate });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(
        result.data.ids.length > 1
          ? `${result.data.ids.length} abonnements créés.`
          : "Abonnement créé.",
      );
      router.push(`/abonnements/${result.data.ids[0]}`);
    });
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <RepeatIcon /> Créer l&apos;abonnement
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer l&apos;abonnement</DialogTitle>
            <DialogDescription>
              Les lignes d&apos;abonnement du devis deviennent un abonnement (un par périodicité).
              La première facture est générée à la date de début, puis au début de chaque période.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="subscription-start">Date de début</Label>
            <Input
              id="subscription-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={create} disabled={pending || !startDate}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
