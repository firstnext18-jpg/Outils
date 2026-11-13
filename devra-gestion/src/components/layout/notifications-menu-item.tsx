"use client";

import { BellIcon, BellOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
} from "@/modules/discussions/actions";

type State = "loading" | "unsupported" | "blocked" | "off" | "on" | "desktop";

/** Clé publique VAPID (base64url) → octets attendus par pushManager.subscribe. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** « Edge · Windows » : pour reconnaître l'appareil. */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Navigateur";
  const system = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return [browser, system].filter(Boolean).join(" · ");
}

function supported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** État des notifications sur ce navigateur (lu une fois affiché). */
async function detectState(): Promise<State> {
  // Application de bureau : elle affiche elle-même les notifications du système.
  if (/GestionBureau\//.test(navigator.userAgent)) return "desktop";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  try {
    const subscription = await currentSubscription();
    return subscription && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

/**
 * Notifications de l'appareil (Windows, macOS, Android…) pour les nouveaux
 * messages des discussions, à activer sur chaque ordinateur ou téléphone.
 */
export function NotificationsMenuItem({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    void detectState().then((detected) => {
      if (!cancelled) setState(detected);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "blocked" : "off");
      toast.error("Notifications refusées par le navigateur.");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      // Un ancien abonnement (autres clés) empêcherait d'en créer un nouveau.
      await (await registration.pushManager.getSubscription())?.unsubscribe();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      });
      const { endpoint, keys } = subscription.toJSON();
      const result = await savePushSubscriptionAction({
        endpoint: endpoint ?? "",
        keys: { p256dh: keys?.p256dh ?? "", auth: keys?.auth ?? "" },
        device: deviceLabel(),
      });
      if (!result.ok) {
        await subscription.unsubscribe();
        toast.error(result.error);
        return;
      }
      setState("on");
      toast.success("Notifications activées sur cet appareil.");
    } catch (error) {
      console.error(error);
      toast.error("Impossible d'activer les notifications sur ce navigateur.");
    }
  }

  async function disable() {
    const subscription = await currentSubscription();
    if (subscription) {
      await deletePushSubscriptionAction({ endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }
    setState("off");
    toast.success("Notifications désactivées sur cet appareil.");
  }

  if (state === "loading" || state === "unsupported") return null;
  if (state === "desktop") {
    return (
      <DropdownMenuItem disabled>
        <BellIcon /> Notifications de l&apos;application activées
      </DropdownMenuItem>
    );
  }
  if (!publicKey) {
    return (
      <DropdownMenuItem disabled>
        <BellOffIcon /> Notifications non configurées
      </DropdownMenuItem>
    );
  }
  if (state === "blocked") {
    return (
      <DropdownMenuItem
        onSelect={() =>
          toast.info(
            "Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur (cadenas à gauche de l'adresse), puis rechargez la page.",
          )
        }
      >
        <BellOffIcon /> Notifications bloquées
      </DropdownMenuItem>
    );
  }
  return state === "on" ? (
    <DropdownMenuItem onSelect={() => void disable()}>
      <BellOffIcon /> Désactiver les notifications
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem onSelect={() => void enable()}>
      <BellIcon /> Activer les notifications
    </DropdownMenuItem>
  );
}
