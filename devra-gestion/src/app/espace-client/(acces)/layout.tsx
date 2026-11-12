import { CompanyBrand } from "@/components/company-brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { displayCompanyName, getSettings } from "@/modules/settings/service";

// Lu en base à chaque requête (jamais pré-généré au build).
export const dynamic = "force-dynamic";

/** Connexion à l'espace client et mot de passe oublié : carte centrée. */
export default async function PortalAccessLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
        <CompanyBrand
          name={displayCompanyName(settings)}
          logoFile={settings.logoFile}
          className="justify-center text-lg [&_img]:h-12 [&_img]:max-w-48"
        />
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
