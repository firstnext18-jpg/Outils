"use client";

import { PencilIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { checkSiteNowAction, deleteSiteAction } from "@/modules/sites/actions";

export function SiteActions({ site }: { site: { id: string; name: string; clientId: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function check() {
    startTransition(async () => {
      const result = await checkSiteNowAction({ id: site.id });
      if (result.ok) toast.success("Vérification terminée.");
      else toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteSiteAction({ id: site.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Site supprimé.");
      router.replace(`/clients/${site.clientId}`);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={check} disabled={pending}>
        <RefreshCwIcon className={pending ? "animate-spin" : undefined} />
        {pending ? "Vérification…" : "Vérifier maintenant"}
      </Button>
      <Button asChild>
        <Link href={`/sites/${site.id}/modifier`}>
          <PencilIcon /> Modifier
        </Link>
      </Button>
      <ConfirmButton
        variant="outline"
        size="default"
        destructive
        disabled={pending}
        title={`Supprimer « ${site.name} » ?`}
        description="Le site, son historique de disponibilité et ses rappels de renouvellement seront supprimés."
        confirmLabel="Supprimer"
        onConfirm={remove}
      >
        <Trash2Icon /> Supprimer
      </ConfirmButton>
    </div>
  );
}
