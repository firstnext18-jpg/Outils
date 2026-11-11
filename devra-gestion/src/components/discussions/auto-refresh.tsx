"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Recharge les données de la page à intervalle régulier tant qu'elle est
 * visible, et dès qu'on y revient : nouveaux messages, pastilles « non lu ».
 * Les champs en cours de saisie ne sont pas effacés.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);
  return null;
}
