import {
  FileArchiveIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  type LucideIcon,
} from "lucide-react";
import { fileKind, formatFileSize, type FileKind } from "@/domain/files";
import { cn } from "@/lib/utils";

const ICONS: Record<FileKind, LucideIcon> = {
  image: FileImageIcon,
  pdf: FileTextIcon,
  document: FileTextIcon,
  archive: FileArchiveIcon,
  other: FileIcon,
};

export type FileListItem = {
  id: string;
  name: string;
  size: number;
  /** Lien de téléchargement. */
  href: string;
  /** Date (et auteur) déjà mis en forme. */
  meta: string;
  badges?: string[];
  /** Boutons propres à la page (partage, suppression). */
  actions?: React.ReactNode;
};

/** Liste de fichiers : icône, nom (téléchargement), taille, date et auteur. */
export function FileList({
  files,
  label,
  className,
}: {
  files: FileListItem[];
  label: string;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y rounded-md border", className)} aria-label={label}>
      {files.map((file) => {
        const Icon = ICONS[fileKind(file.name)];
        return (
          <li key={file.id} className="flex items-center gap-3 p-3 text-sm">
            <Icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <a
                href={file.href}
                className="block truncate font-medium hover:underline"
                download={file.name}
              >
                {file.name}
              </a>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                <span>{formatFileSize(file.size)}</span>
                <span>· {file.meta}</span>
                {file.badges?.map((badge) => (
                  <span key={badge} className="bg-muted rounded px-1.5 py-0.5">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            {file.actions}
          </li>
        );
      })}
    </ul>
  );
}
