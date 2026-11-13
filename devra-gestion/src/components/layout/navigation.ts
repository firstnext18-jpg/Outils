import {
  CalendarDaysIcon,
  FileTextIcon,
  GlobeIcon,
  FolderKanbanIcon,
  TimerIcon,
  WalletIcon,
  LayoutDashboardIcon,
  MessagesSquareIcon,
  PackageIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/domain/roles";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Rôle minimum pour voir l'entrée. */
  role: Role;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Tableau de bord", href: "/", icon: LayoutDashboardIcon, role: "READONLY" },
  { title: "Discussions", href: "/discussions", icon: MessagesSquareIcon, role: "READONLY" },
  { title: "Clients", href: "/clients", icon: UsersIcon, role: "READONLY" },
  { title: "Projets", href: "/projets", icon: FolderKanbanIcon, role: "READONLY" },
  { title: "Temps", href: "/temps", icon: TimerIcon, role: "READONLY" },
  { title: "Sites", href: "/sites", icon: GlobeIcon, role: "READONLY" },
  { title: "Calendrier", href: "/calendrier", icon: CalendarDaysIcon, role: "READONLY" },
  { title: "Devis", href: "/devis", icon: FileTextIcon, role: "READONLY" },
  { title: "Factures", href: "/factures", icon: ReceiptTextIcon, role: "READONLY" },
  { title: "Abonnements", href: "/abonnements", icon: RepeatIcon, role: "READONLY" },
  { title: "Dépenses", href: "/depenses", icon: WalletIcon, role: "READONLY" },
  { title: "Catalogue", href: "/catalogue", icon: PackageIcon, role: "READONLY" },
  { title: "Paramètres", href: "/parametres", icon: SettingsIcon, role: "ADMIN" },
];

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
