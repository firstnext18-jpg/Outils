import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { CompanyBrand } from "@/components/company-brand";
import { PortalNav } from "@/components/portal/portal-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { portalTexts } from "@/i18n/portal";
import { portalLogoutAction } from "@/modules/portal/actions";
import { portalUnreadCount } from "@/modules/portal/service";
import { displayCompanyName, getSettings } from "@/modules/settings/service";
import { requirePortalSession } from "@/server/portal-session";

// Lu en base à chaque requête (jamais pré-généré au build).
export const dynamic = "force-dynamic";

/**
 * Espace du client connecté : en-tête (logo de l'entreprise, déconnexion) et
 * onglets. Chaque page vérifie aussi la session : le layout n'est pas
 * réexécuté à chaque navigation.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePortalSession();
  const [settings, unread] = await Promise.all([
    getSettings(),
    portalUnreadCount(session.client.id),
  ]);
  const t = portalTexts(session.client.language);
  const company = displayCompanyName(settings);

  return (
    <div lang={session.client.language === "DE" ? "de" : "fr"} className="bg-muted/40 min-h-svh">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-3">
          <Link href="/espace-client" className="flex min-w-0 items-center gap-3">
            <CompanyBrand name={company} logoFile={settings.logoFile} />
            <span className="text-muted-foreground hidden text-sm sm:inline">{t.portalTitle}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-muted-foreground hidden max-w-48 truncate text-sm md:inline">
              {session.client.displayName}
            </span>
            <ThemeToggle />
            <form action={portalLogoutAction}>
              <Button type="submit" variant="ghost" size="sm" aria-label={t.signOut}>
                <LogOutIcon /> <span className="hidden sm:inline">{t.signOut}</span>
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-2 pt-2 sm:px-4">
          <PortalNav
            label={t.menu}
            items={[
              { href: "/espace-client", label: t.navHome },
              { href: "/espace-client/devis", label: t.navQuotes },
              { href: "/espace-client/factures", label: t.navInvoices },
              { href: "/espace-client/abonnements", label: t.navSubscriptions },
              { href: "/espace-client/discussion", label: t.navDiscussion, badge: unread },
              { href: "/espace-client/compte", label: t.navAccount },
            ]}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
