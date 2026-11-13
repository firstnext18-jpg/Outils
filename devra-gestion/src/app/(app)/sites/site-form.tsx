"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClientPicker } from "@/components/documents/editor/client-picker";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { domainFromUrl, normalizeSiteUrl } from "@/domain/sites";
import type { PickerClient } from "@/modules/clients/service";
import { createSiteAction, updateSiteAction } from "@/modules/sites/actions";
import type { SiteInput } from "@/modules/sites/schemas";

export type SiteFormValues = SiteInput;

/** Création ou modification d'un site : adresse, domaine, hébergement, surveillance. */
export function SiteForm({
  siteId,
  client: initialClient,
  defaultValues,
}: {
  siteId?: string;
  client: PickerClient | null;
  defaultValues: SiteFormValues;
}) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [values, setValues] = useState(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<SiteFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const normalized = normalizeSiteUrl(values.url);
  const guessedDomain = normalized ? domainFromUrl(normalized) : "";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = siteId
        ? await updateSiteAction({ id: siteId, site: values })
        : await createSiteAction({ site: values });
      if (!result.ok) {
        setError(Object.values(result.fieldErrors ?? {})[0]?.[0] ?? result.error);
        return;
      }
      toast.success(siteId ? "Site enregistré." : "Site ajouté.");
      router.push(`/sites/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <FormError message={error} />
      <Card>
        <CardHeader>
          <CardTitle>Site</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="site-client">Client</Label>
            <ClientPicker
              id="site-client"
              value={client}
              onChange={(picked) => {
                setClient(picked);
                set({ clientId: picked.id });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-name">Nom</Label>
            <Input
              id="site-name"
              value={values.name}
              maxLength={120}
              placeholder="ex. Site vitrine"
              onChange={(event) => set({ name: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-url">Adresse du site</Label>
            <Input
              id="site-url"
              value={values.url}
              maxLength={500}
              inputMode="url"
              placeholder="https://www.exemple.ch"
              onChange={(event) => set({ url: event.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="site-notes">Notes (internes)</Label>
            <Textarea
              id="site-notes"
              value={values.notes}
              maxLength={2000}
              rows={2}
              placeholder="ex. accès FTP dans le gestionnaire de mots de passe"
              onChange={(event) => set({ notes: event.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domaine et hébergement</CardTitle>
          <CardDescription>
            Un rappel est envoyé à l&apos;équipe avant chaque échéance (délai dans Paramètres →
            Projets et sites).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="site-domain">Nom de domaine</Label>
            <Input
              id="site-domain"
              value={values.domain}
              maxLength={253}
              placeholder={guessedDomain || "exemple.ch"}
              onChange={(event) => set({ domain: event.target.value })}
            />
            <p className="text-muted-foreground text-xs">
              Vide : déduit de l&apos;adresse du site.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-registrar">Registraire</Label>
            <Input
              id="site-registrar"
              value={values.registrar}
              maxLength={120}
              placeholder="ex. Infomaniak, Hostpoint"
              onChange={(event) => set({ registrar: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-domain-expires">Expiration du domaine</Label>
            <Input
              id="site-domain-expires"
              type="date"
              value={values.domainExpiresAt}
              onChange={(event) => set({ domainExpiresAt: event.target.value })}
            />
          </div>
          <label className="flex items-center gap-3 self-end pb-2 text-sm">
            <Switch
              checked={values.domainExpiryAuto}
              onCheckedChange={(domainExpiryAuto) => set({ domainExpiryAuto })}
            />
            Lire la date automatiquement chaque jour
          </label>
          <p className="text-muted-foreground -mt-2 text-xs md:col-span-2">
            La date est lue dans le registre public (RDAP) quand il la publie : .com, .net, .org,
            .shop… Les registres .ch et .li ne la publient pas : saisissez-la à la main.
          </p>
          <div className="space-y-2">
            <Label htmlFor="site-hosting">Hébergeur</Label>
            <Input
              id="site-hosting"
              value={values.hostingProvider}
              maxLength={120}
              onChange={(event) => set({ hostingProvider: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-hosting-renews">Renouvellement de l&apos;hébergement</Label>
            <Input
              id="site-hosting-renews"
              type="date"
              value={values.hostingRenewsAt}
              onChange={(event) => set({ hostingRenewsAt: event.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Surveillance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={values.monitor} onCheckedChange={(monitor) => set({ monitor })} />
            Vérifier le site toutes les quelques minutes et alerter l&apos;équipe s&apos;il ne
            répond plus
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={values.showStatusToClient}
              disabled={!values.monitor}
              onCheckedChange={(showStatusToClient) => set({ showStatusToClient })}
            />
            Montrer l&apos;état du site au client dans son espace (en ligne, disponibilité sur 30
            jours)
          </label>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : siteId ? "Enregistrer" : "Ajouter le site"}
      </Button>
    </form>
  );
}
