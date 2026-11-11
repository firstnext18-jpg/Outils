import "server-only";
import webpush, { WebPushError } from "web-push";
import { db } from "@/server/db";
import { env, type Env } from "@/server/env";

/** Contenu d'une notification, lu par le service worker (public/sw.js). */
export type PushPayload = {
  title: string;
  body: string;
  /** Page ouverte au clic. */
  url: string;
  /** Les notifications de même étiquette se remplacent (une par discussion). */
  tag: string;
};

/**
 * Contact exigé par les services de notification : VAPID_SUBJECT, sinon
 * l'adresse de l'application (https), sinon l'adresse d'envoi des emails.
 */
function vapidSubject(e: Env): string {
  if (e.VAPID_SUBJECT) return e.VAPID_SUBJECT;
  if (e.APP_URL.startsWith("https://")) return e.APP_URL;
  const address = /<([^>]+)>/.exec(e.SMTP_FROM)?.[1] ?? e.SMTP_FROM;
  return `mailto:${address.trim()}`;
}

let ready: boolean | undefined;

/** Configure web-push une fois ; faux si les clés manquent ou sont invalides. */
function setup(): boolean {
  if (ready !== undefined) return ready;
  const e = env();
  if (!e.VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) return (ready = false);
  try {
    webpush.setVapidDetails(vapidSubject(e), e.VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
    return (ready = true);
  } catch (error) {
    console.error("Notifications désactivées : clés VAPID invalides (.env)", error);
    return (ready = false);
  }
}

/** Clé publique transmise au navigateur pour s'abonner ; null si les notifications sont désactivées. */
export function pushPublicKey(): string | null {
  return setup() ? env().VAPID_PUBLIC_KEY! : null;
}

type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(subscriptions: StoredSubscription[], payload: PushPayload) {
  const message = JSON.stringify(payload);
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          { TTL: 24 * 60 * 60, urgency: "normal" },
        );
      } catch (error) {
        // Abonnement expiré ou révoqué par l'utilisateur : on l'oublie.
        if (error instanceof WebPushError && [404, 410].includes(error.statusCode)) {
          await db.pushSubscription.deleteMany({ where: { id: sub.id } });
        } else {
          console.error("Notification impossible", error);
        }
      }
    }),
  );
}

/** Notification à tous les appareils abonnés des utilisateurs donnés (actifs). */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0 || !setup()) return;
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId: { in: userIds }, user: { active: true } },
  });
  await deliver(subscriptions, payload);
}

/** Notification à un seul appareil (confirmation après l'activation). */
export async function sendPushToEndpoint(endpoint: string, payload: PushPayload): Promise<void> {
  if (!setup()) return;
  const subscription = await db.pushSubscription.findUnique({ where: { endpoint } });
  if (subscription) await deliver([subscription], payload);
}
