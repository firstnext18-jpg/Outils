import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { EmailLogRow } from "@/modules/emails/service";

/** Historique des envois par email d'un devis ou d'une facture. */
export function EmailHistoryCard({ logs }: { logs: EmailLogRow[] }) {
  if (logs.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Envois par email</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {logs.map((log) => (
            <li key={log.id} className="flex gap-3 py-2 first:pt-0 last:pb-0">
              {log.status === "SENT" ? (
                <CheckCircle2Icon
                  className="text-success mt-0.5 size-4 shrink-0"
                  aria-label="Envoyé"
                />
              ) : (
                <XCircleIcon
                  className="text-destructive mt-0.5 size-4 shrink-0"
                  aria-label="Échec"
                />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-medium break-words">À {log.recipients.join(", ")}</p>
                <p className="text-muted-foreground truncate">{log.subject}</p>
                {log.status === "FAILED" && (
                  <p className="text-destructive">Échec de l&apos;envoi : {log.error}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(log.createdAt)}
                  {log.sentBy && ` · ${log.sentBy.name}`}
                  {log.bcc.length > 0 && " · copie à l'expéditeur"}
                  {` · ${log.attachment}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
