"use client";

import { SendIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FilePicker } from "@/components/files/file-picker";
import { MESSAGE_MAX } from "@/domain/discussions";
import { FILES_PER_UPLOAD, formatFileSize } from "@/domain/files";

/**
 * Zone de saisie d'un message (équipe ou espace client) : Entrée envoie,
 * Maj+Entrée passe à la ligne, le trombone joint des fichiers. `onSend`
 * renvoie un message d'erreur, ou `null`.
 */
export function MessageComposer({
  onSend,
  labels,
}: {
  onSend: (body: string, files: File[]) => Promise<string | null>;
  labels: { field: string; placeholder: string; send: string; attach: string; remove: string };
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const ready = body.trim() !== "" || files.length > 0;

  async function send() {
    if (!ready || sending) return;
    setSending(true);
    const error = await onSend(body, files);
    setSending(false);
    if (error) {
      toast.error(error);
      return;
    }
    setBody("");
    setFiles([]);
    router.refresh();
  }

  return (
    <form
      className="bg-background sticky bottom-0 space-y-2 border-t py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={labels.attach}>
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="bg-muted flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-xs"
            >
              <span className="max-w-48 truncate">{file.name}</span>
              <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
              <button
                type="button"
                className="hover:bg-background rounded p-0.5"
                aria-label={labels.remove.replace("{name}", file.name)}
                onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <FilePicker
          label={labels.attach}
          iconOnly
          variant="ghost"
          disabled={sending}
          onPick={(picked) =>
            setFiles((current) => [...current, ...picked].slice(0, FILES_PER_UPLOAD))
          }
        />
        <Textarea
          aria-label={labels.field}
          placeholder={labels.placeholder}
          value={body}
          maxLength={MESSAGE_MAX}
          rows={2}
          className="max-h-48 min-h-11 resize-none"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <Button type="submit" disabled={sending || !ready}>
          <SendIcon /> {labels.send}
        </Button>
      </div>
    </form>
  );
}
