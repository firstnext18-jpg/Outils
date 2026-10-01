"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/parametres/entreprise", label: "Entreprise" },
  { href: "/parametres/documents", label: "Documents" },
  { href: "/parametres/facturation", label: "Facturation" },
  { href: "/parametres/emails", label: "Emails" },
  { href: "/parametres/relances", label: "Relances" },
  { href: "/parametres/taches", label: "Tâches" },
  { href: "/parametres/types-de-sites", label: "Types de sites" },
  { href: "/parametres/utilisateurs", label: "Utilisateurs" },
  { href: "/parametres/journal", label: "Journal" },
];

/** Onglets des paramètres. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0"
      aria-label="Sections des paramètres"
    >
      <ul className="flex gap-1">
        {SECTIONS.map((section) => {
          const active = pathname.startsWith(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "border-foreground text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
