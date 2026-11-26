import { FileList } from "@/components/files/file-list";
import { Badge } from "@/components/ui/badge";
import { messageParts } from "@/domain/discussions";
import { splitQuoted } from "@/domain/mails";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ThreadMail = {
  id: string;
  direction: "OUTGOING" | "INCOMING";
  subject: string;
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  bodyText: string;
  date: Date;
  readAt: Date | null;
  sentBy: { name: string } | null;
  attachments: { id: string; name: string; size: number }[];
};

function Text({ value }: { value: string }) {
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {messageParts(value).map((part, i) =>
        part.url ? (
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

/**
 * Emails échangés avec un client, du plus ancien au plus récent. Le texte est
 * affiché tel quel (jamais de HTML interprété) ; le message cité dans une
 * réponse se déplie à la demande.
 */
export function MailThread({ mails, clientName }: { mails: ThreadMail[]; clientName: string }) {
  return (
    <ol className="space-y-4" aria-label="Emails">
      {mails.map((mail) => {
        const incoming = mail.direction === "INCOMING";
        const { body, quoted } = splitQuoted(mail.bodyText);
        return (
          <li
            key={mail.id}
            className={cn(
              "rounded-lg border p-4",
              incoming ? "border-l-4 border-l-zinc-900 dark:border-l-white" : "bg-muted/40",
            )}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">
                  {incoming
                    ? mail.fromName || clientName
                    : (mail.sentBy?.name ?? mail.fromName) || "Vous"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {incoming ? mail.fromAddress : `à ${mail.toAddresses.join(", ")}`}
                </span>
                <Badge variant={incoming ? "default" : "secondary"} className="text-[11px]">
                  {incoming ? "Reçu" : "Envoyé"}
                </Badge>
              </div>
              <time
                dateTime={mail.date.toISOString()}
                className="text-muted-foreground text-xs tabular-nums"
              >
                {formatDateTime(mail.date)}
              </time>
            </div>
            <p className="mb-2 text-sm font-medium">{mail.subject}</p>
            {body ? <Text value={body} /> : <p className="text-muted-foreground text-sm">(vide)</p>}
            {quoted && (
              <details className="mt-2">
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  Afficher le message cité
                </summary>
                <div className="text-muted-foreground mt-2 border-l-2 pl-3">
                  <Text value={quoted} />
                </div>
              </details>
            )}
            {mail.attachments.length > 0 && (
              <FileList
                className="mt-3"
                label={`Pièces jointes : ${mail.subject}`}
                files={mail.attachments.map((file) => ({
                  id: file.id,
                  name: file.name,
                  size: file.size,
                  meta: incoming ? "reçue" : "envoyée",
                  href: `/api/fichiers/${file.id}`,
                }))}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
