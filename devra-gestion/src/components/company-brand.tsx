/* eslint-disable @next/next/no-img-element -- logo servi par l'API, taille inconnue à l'avance */
import { cn } from "@/lib/utils";

/** Logo de l'entreprise (s'il existe) ou son nom. */
export function CompanyBrand({
  name,
  logoFile,
  className,
  showName = true,
}: {
  name: string;
  logoFile: string | null;
  className?: string;
  showName?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {logoFile ? (
        <img
          src={`/api/logo?v=${encodeURIComponent(logoFile)}`}
          alt={`Logo ${name}`}
          className="h-8 w-auto max-w-32 object-contain"
        />
      ) : (
        <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {showName && !logoFile && <span className="truncate font-semibold">{name}</span>}
    </div>
  );
}
