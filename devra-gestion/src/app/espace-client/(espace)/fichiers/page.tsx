import type { Metadata } from "next";
import { PortalFilesUpload } from "@/app/espace-client/(espace)/fichiers/files-upload";
import { FileList } from "@/components/files/file-list";
import { portalTexts } from "@/i18n/portal";
import { formatDateTime } from "@/lib/format";
import { listPortalFiles } from "@/modules/files/service";
import { displayCompanyName, getSettings } from "@/modules/settings/service";
import { requirePortalSession } from "@/server/portal-session";

export const metadata: Metadata = { title: "Fichiers · Dateien" };

/** Fichiers partagés avec le client, et ceux qu'il a envoyés. */
export default async function PortalFilesPage() {
  const { client } = await requirePortalSession();
  const t = portalTexts(client.language);
  const [files, settings] = await Promise.all([listPortalFiles(client.id), getSettings()]);
  const company = displayCompanyName(settings);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t.navFiles}</h1>
          <p className="text-muted-foreground text-sm">{t.filesHelp}</p>
        </div>
        <PortalFilesUpload t={t} />
      </div>
      {files.length > 0 ? (
        <FileList
          label={t.navFiles}
          className="bg-background"
          files={files.map((file) => ({
            id: file.id,
            name: file.name,
            size: file.size,
            href: `/api/espace-client/fichiers/${file.id}`,
            meta: `${formatDateTime(file.createdAt)} · ${file.uploadedByClient ? t.you : company}`,
            badges: file.uploadedByClient ? [t.sentByYou] : [],
          }))}
        />
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          {t.noFiles}
        </p>
      )}
    </>
  );
}
