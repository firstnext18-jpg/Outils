"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { FilePicker } from "@/components/files/file-picker";
import type { PortalTexts } from "@/i18n/portal";
import { portalUploadFilesAction } from "@/modules/portal/actions";

/** Envoi de fichiers par le client (logo, textes, photos…). */
export function PortalFilesUpload({ t }: { t: PortalTexts }) {
  const [pending, startTransition] = useTransition();
  return (
    <FilePicker
      label={t.sendFiles}
      variant="default"
      disabled={pending}
      onPick={(files) => {
        const form = new FormData();
        for (const file of files) form.append("files", file);
        startTransition(async () => {
          const result = await portalUploadFilesAction(form);
          if (result.ok) toast.success(t.filesSent);
          else toast.error(result.error);
        });
      }}
    />
  );
}
