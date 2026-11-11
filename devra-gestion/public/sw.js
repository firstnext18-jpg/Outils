/*
 * Service worker de l'application : affiche les notifications des discussions
 * (Web Push), même quand l'application n'est pas ouverte dans un onglet.
 * Voir src/server/push.ts (envoi) et src/components/layout/notifications-menu-item.tsx.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const url = new URL(data.url || "/discussions", self.location.origin).href;

  event.waitUntil(
    (async () => {
      // La discussion est déjà affichée devant l'utilisateur : inutile de le notifier.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.some((w) => w.focused && w.visibilityState === "visible" && w.url === url)) {
        return;
      }
      await self.registration.showNotification(data.title || "Nouveau message", {
        body: data.body || "",
        tag: data.tag,
        renotify: Boolean(data.tag),
        icon: "/api/logo",
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.location.origin;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = windows.find((w) => w.url === url);
      if (same) return same.focus();
      const any = windows.find((w) => "navigate" in w);
      if (any) {
        await any.focus();
        return any.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
