"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Petit carré blanc aux bords arrondis avec le nombre de messages non lus
 * (bordure légère pour rester visible sur fond clair).
 */
export function UnreadCount({
  count,
  className,
  noun = "message",
}: {
  count: number;
  className?: string;
  /** Ce qui est compté (libellé lu par les lecteurs d'écran). */
  noun?: "message" | "email";
}) {
  if (count <= 0) return null;
  const plural = count > 1 ? "s" : "";
  return (
    <span
      aria-label={`${count} ${noun}${plural} non lu${plural}`}
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white px-1 text-xs font-semibold text-zinc-900 tabular-nums shadow-sm ring-1 ring-zinc-900/15",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export type UnreadCounts = { discussions: number; mails: number };

const UnreadContext = createContext<UnreadCounts>({ discussions: 0, mails: 0 });

/**
 * Messages non lus de l'utilisateur (discussions) et emails des clients pas
 * encore ouverts, tenus à jour toutes les 30 secondes.
 */
export function UnreadProvider({
  initial,
  children,
}: {
  initial: UnreadCounts;
  children: React.ReactNode;
}) {
  const [counts, setCounts] = useState(initial);
  // Nouvelles valeurs du serveur à chaque navigation.
  const [previous, setPrevious] = useState(initial);
  if (initial.discussions !== previous.discussions || initial.mails !== previous.mails) {
    setPrevious(initial);
    setCounts(initial);
  }

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { discussions?: number; mails?: number };
        if (!stopped && typeof data.discussions === "number") {
          setCounts({ discussions: data.discussions, mails: data.mails ?? 0 });
        }
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

  return <UnreadContext.Provider value={counts}>{children}</UnreadContext.Provider>;
}

export function useUnreadCounts(): UnreadCounts {
  return useContext(UnreadContext);
}

/** Pastille des non lus à côté du bouton du menu, sur téléphone (menu replié). */
export function HeaderUnread() {
  const { discussions, mails } = useUnreadCounts();
  if (discussions + mails <= 0) return null;
  return (
    <Link
      href={discussions > 0 ? "/discussions" : "/mails"}
      className="md:hidden"
      aria-label={discussions > 0 ? "Discussions" : "Mail"}
    >
      <UnreadCount count={discussions + mails} noun={discussions > 0 ? "message" : "email"} />
    </Link>
  );
}
