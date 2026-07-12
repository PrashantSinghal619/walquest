// walquest service worker
// Phase 13: web-push display + click handling. Deliberately NO fetch
// handler for app assets - Next.js manages its own caching and a stale
// asset cache is worse than none.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload - show something rather than nothing
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "walquest", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "walquest",
      data: { url: data.url || "/map" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/map";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const win of windows) {
          if ("focus" in win) {
            win.navigate(url);
            return win.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
