"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompanyBrand } from "@/components/company-brand";
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
  badges,
  pushPublicKey,
}: {
  user: CurrentUser;
  company: { name: string; logoFile: string | null };
  /** Pastilles par entrée du menu, ex. discussions non lues. */
  badges: Partial<Record<string, number>>;
  /** Clé publique des notifications ; null si elles ne sont pas configurées. */
  pushPublicKey: string | null;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const items = NAV_ITEMS.filter((item) => hasRole(user.role, item.role));

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
                    <SidebarMenuBadge aria-label={`${badges[item.href]} non lu(s)`}>
                      {badges[item.href]}
                    </SidebarMenuBadge>
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
