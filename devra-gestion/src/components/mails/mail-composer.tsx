"use client";

import { SendIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClientPicker } from "@/components/documents/editor/client-picker";
import { FilePicker } from "@/components/files/file-picker";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadProblem } from "@/domain/files";
import type { PickerClient } from "@/modules/clients/service";
import { sendClientEmailAction } from "@/modules/mails/actions";

/**
 * Nouvel email à un client, ou réponse dans sa conversation (`replyToId`).
 * La signature de l'entreprise (Paramètres) est ajoutée à l'envoi.
 */
export function MailComposer({
  client: initialClient,
  defaultSubject = "",
  replyToId = null,
  recipient,
}: {
  /** Client choisi ; `null` : à choisir (nouvel email). */
  client: PickerClient | { id: string } | null;
  defaultSubject?: string;
  replyToId?: string | null;
  /** Adresse affichée (réponse dans une conversation). */
  recipient?: string;
}) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const choosing = initialClient === null || "displayName" in initialClient;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("mail", JSON.stringify({ clientId: client?.id ?? "", subject, body, replyToId }));
      for (const file of files) form.append("files", file);
      const result = await sendClientEmailAction(form);
      if (!result.ok) {
        setError(Object.values(result.fieldErrors ?? {})[0]?.[0] ?? result.error);
        return;
      }
      toast.success("Email envoyé.");
      setBody("");
      setFiles([]);
      router.push(`/mails/${result.data.clientId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={error} />
      {choosing ? (
        <div className="space-y-2">
          <Label htmlFor="mail-client">Client</Label>
          <ClientPicker
            id="mail-client"
            value={client && "displayName" in client ? client : null}
            onChange={(picked) => setClient(picked)}
          />
        </div>
      ) : (
        recipient && (
          <p className="text-muted-foreground text-sm">
            À : <span className="text-foreground">{recipient}</span>
          </p>
        )
      )}
      <div className="space-y-2">
        <Label htmlFor="mail-subject">Objet</Label>
        <Input
          id="mail-subject"
          value={subject}
          maxLength={200}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mail-body">Message</Label>
        <Textarea
          id="mail-body"
          rows={8}
          value={body}
          maxLength={20_000}
          placeholder="Bonjour,"
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          La signature de l&apos;entreprise (Paramètres → Entreprise) est ajoutée automatiquement.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FilePicker
          label="Joindre des fichiers"
          disabled={pending}
          onPick={(picked) => {
            const all = [...files, ...picked].slice(0, 5);
            const problem = uploadProblem(all);
            if (problem) return toast.error(problem);
            setFiles(all);
          }}
        />
        {files.map((file, i) => (
          <span
            key={`${file.name}-${i}`}
            className="bg-muted flex items-center gap-1 rounded px-2 py-0.5 text-xs"
          >
            {file.name}
            <button
              type="button"
              aria-label={`Retirer ${file.name}`}
              onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <Button type="submit" disabled={pending}>
        <SendIcon /> {pending ? "Envoi…" : "Envoyer"}
      </Button>
    </form>
  );
}
