import { ThemeToggle } from "@/components/theme-toggle";

// Lu en base à chaque requête (jamais pré-généré au build).
export const dynamic = "force-dynamic";

/** Pages publiques destinées aux clients (acceptation des devis en ligne). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/40 min-h-svh">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16">{children}</main>
    </div>
  );
}
