import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Accès refusé" };

export default async function AccessDeniedPage() {
  await requireUser();
  return (
    <EmptyState
      icon={ShieldAlertIcon}
      title="Accès refusé"
      description="Votre rôle ne permet pas d'accéder à cette page. Si vous pensez que c'est une erreur, contactez un administrateur."
      action={
        <Button asChild variant="outline">
          <Link href="/">Retour au tableau de bord</Link>
        </Button>
      }
    />
  );
}
