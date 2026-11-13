"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompanyBrand } from "@/components/company-brand";
import { UnreadCount, useUnreadCount } from "@/components/discussions/unread-count";
import { isActivePath, NAV_ITEMS } from "@/components/layout/navigation";
import { UserMenu } from "@/components/layout/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { hasRole } from "@/domain/roles";
import type { CurrentUser } from "@/server/session";

export function AppSidebar({
  user,
  company,
  pushPublicKey,
}: {
  user: CurrentUser;
  company: { name: string; logoFile: string | null };
  /** Clé publique des notifications ; null si elles ne sont pas configurées. */
  pushPublicKey: string | null;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const items = NAV_ITEMS.filter((item) => hasRole(user.role, item.role));
  const unread = useUnreadCount();
  const badges: Partial<Record<string, number>> = { "/discussions": unread };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/" className="flex h-10 items-center px-1" aria-label="Tableau de bord">
          <CompanyBrand name={company.name} logoFile={company.logoFile} />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActivePath(pathname, item.href)}
                  >
                    <Link href={item.href} onClick={() => isMobile && setOpenMobile(false)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {(badges[item.href] ?? 0) > 0 && (
                    <>
                      <SidebarMenuBadge className="h-auto min-w-0 px-0">
                        <UnreadCount count={badges[item.href]!} />
                      </SidebarMenuBadge>
                      {/* Menu réduit aux icônes : pastille sur l'icône. */}
                      <UnreadCount
                        count={badges[item.href]!}
                        className="pointer-events-none absolute -top-1 right-0 hidden h-4 min-w-4 px-0.5 text-[10px] group-data-[collapsible=icon]:inline-flex"
                      />
                    </>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu user={user} pushPublicKey={pushPublicKey} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
