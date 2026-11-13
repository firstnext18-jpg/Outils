"use client";

import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createCalendarFeedAction, deleteCalendarFeedAction } from "@/modules/calendar/actions";

/** Abonnement iCal personnel : l'adresse n'est affichée qu'à sa création. */
export function CalendarFeedCard({ active }: { active: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createCalendarFeedAction({});
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl(result.data.url);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteCalendarFeedAction({});
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl(null);
      toast.success("Abonnement désactivé.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dans votre agenda</CardTitle>
        <CardDescription>
          Abonnez Outlook, Google Agenda ou le calendrier de votre téléphone à ces échéances : ils
          se mettent à jour tout seuls. L&apos;adresse est personnelle : quiconque la connaît voit
          les échéances (noms des clients et montants).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {url ? (
          <div className="space-y-2">
            <p className="font-medium">
              Copiez cette adresse maintenant : elle ne sera plus affichée.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={url}
                aria-label="Adresse d'abonnement"
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigator.clipboard
                    .writeText(url)
                    .then(() => toast.success("Adresse copiée."))
                    .catch(() => toast.error("Copie impossible : sélectionnez l'adresse."))
                }
              >
                <CopyIcon /> Copier
              </Button>
            </div>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              <li>
                Outlook : Calendrier → Ajouter un calendrier → S&apos;abonner à partir du web.
              </li>
              <li>Google Agenda : Autres agendas → + → À partir de l&apos;URL.</li>
              <li>
                iPhone : Réglages → Calendrier → Comptes → Ajouter un calendrier avec abonnement.
              </li>
            </ul>
          </div>
        ) : active ? (
          <p className="text-muted-foreground">
            Votre abonnement est actif. Si vous avez perdu l&apos;adresse, créez-en une nouvelle :
            l&apos;ancienne cessera de fonctionner.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={active || url ? "outline" : "default"}
            onClick={create}
            disabled={pending}
          >
            <RefreshCwIcon />{" "}
            {active || url ? "Nouvelle adresse" : "Créer mon adresse d'abonnement"}
          </Button>
          {(active || url) && (
            <ConfirmButton
              variant="ghost"
              size="default"
              disabled={pending}
              title="Désactiver l'abonnement ?"
              description="Votre agenda ne recevra plus les échéances. Vous pourrez créer une nouvelle adresse plus tard."
              confirmLabel="Désactiver"
              onConfirm={remove}
            >
              Désactiver
            </ConfirmButton>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
