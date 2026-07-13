// walquest service worker
// Phase 13: web-push display + click handling.
// Phase 14: offline cache for OpenFreeMap tiles/glyphs/sprites so the map
// keeps rendering through connectivity drops mid-walk.
//
// Deliberately NO fetch handling for app assets - Next.js manages its own
// caching and a stale asset cache is worse than none. Only requests to the
// tile host are intercepted.

const TILE_CACHE = "walquest-tiles-v1";
const TILE_HOST = "tiles.openfreemap.org";
const MAX_TILE_ENTRIES = 2500; // ~100-150 MB worst case; oldest evicted first

// Take over immediately on update - otherwise a buggy worker keeps
// controlling every open client (worst case: an installed PWA that is
// never fully closed) until long after the fix ships.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("walquest-tiles-") && k !== TILE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.hostname !== TILE_HOST) return;

  // Style JSON: network-first so style updates land, cache fallback offline.
  // Tiles/glyphs/sprites: cache-first - effectively immutable, and latency
  // matters while the map is panning.
  //
  // Final catch: if the caching layer itself fails in any unforeseen way,
  // fall back to a plain network fetch - the cache must never be the
  // reason the map goes blank.
  const strategy = url.pathname.startsWith("/styles/") ? networkFirst : cacheFirst;
  event.respondWith(strategy(event.request).catch(() => fetch(event.request)));
});

// Best-effort store: quota pressure or storage errors (e.g. private
// browsing) must never fail the response that is already in hand.
async function storeInCache(cache, request, response) {
  try {
    await cache.put(request, response);
    await trimCache(cache);
  } catch {
    // drop it - serving the network response matters more than caching it
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(request).catch(() => undefined);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await storeInCache(cache, request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await storeInCache(cache, request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request).catch(() => undefined);
    if (hit) return hit;
    throw err;
  }
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_TILE_ENTRIES) return;
  // cache.keys() is insertion-ordered - drop the oldest overflow
  for (const key of keys.slice(0, keys.length - MAX_TILE_ENTRIES)) {
    await cache.delete(key);
  }
}

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
