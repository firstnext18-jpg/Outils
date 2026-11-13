"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Petit carré blanc aux bords arrondis avec le nombre de messages non lus
 * (bordure légère pour rester visible sur fond clair).
 */
export function UnreadCount({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} message${count > 1 ? "s" : ""} non lu${count > 1 ? "s" : ""}`}
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white px-1 text-xs font-semibold text-zinc-900 tabular-nums shadow-sm ring-1 ring-zinc-900/15",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const UnreadContext = createContext(0);

/** Nombre de messages non lus de l'utilisateur, tenu à jour toutes les 30 secondes. */
export function UnreadProvider({
  initial,
  children,
}: {
  initial: number;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(initial);
  // Nouvelle valeur du serveur à chaque navigation.
  const [previous, setPrevious] = useState(initial);
  if (initial !== previous) {
    setPrevious(initial);
    setCount(initial);
  }

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { unread?: number };
        if (!stopped && typeof data.unread === "number") setCount(data.unread);
      } catch {
        // Hors ligne : on réessaiera.
      }
    };
    const timer = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return <UnreadContext.Provider value={count}>{children}</UnreadContext.Provider>;
}

export function useUnreadCount(): number {
  return useContext(UnreadContext);
}

/** Pastille des non lus à côté du bouton du menu, sur téléphone (menu replié). */
export function HeaderUnread() {
  const count = useUnreadCount();
  if (count <= 0) return null;
  return (
    <Link href="/discussions" className="md:hidden" aria-label="Discussions">
      <UnreadCount count={count} />
    </Link>
  );
}
