"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncMailboxAction } from "@/modules/mails/actions";

/** Relève immédiate de la boîte (sinon toutes les 2 minutes par le conteneur « cron »). */
export function MailSyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncMailboxAction({});
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          if (result.data.error) toast.error(result.data.error);
          else
            toast.success(
              result.data.imported === 0
                ? "Aucun nouvel email de client."
                : `${result.data.imported} nouvel(s) email(s) de client.`,
            );
          router.refresh();
        })
      }
    >
      <RefreshCwIcon className={pending ? "animate-spin" : undefined} />
      {pending ? "Relève…" : "Relever les mails"}
    </Button>
  );
}
