import { cookies } from "next/headers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { displayCompanyName, getSettings } from "@/modules/settings/service";
import { requireUser } from "@/server/session";

// Pages lues en base à chaque requête : jamais pré-générées au build (pas de base à ce moment-là).
export const dynamic = "force-dynamic";

/** Mise en page de l'application connectée : navigation latérale + contenu. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, cookieStore] = await Promise.all([getSettings(), cookies()]);
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        user={user}
        company={{ name: displayCompanyName(settings), logoFile: settings.logoFile }}
      />
      <SidebarInset>
        <header className="bg-background/95 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
