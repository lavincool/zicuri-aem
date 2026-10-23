/* Cauce service worker: app shell, offline page, and a small tile cache.
   Report submissions don't go through here: the in-page IndexedDB outbox
   handles offline reports (iOS has no Background Sync). */
const VERSION = "cauce-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;
const TILE_CACHE = `${VERSION}-tiles`;
const MAX_TILES = 400;

const SHELL = [
  "/",
  "/sin-conexion",
  "/map/styles/cauce-light.json",
  "/map/styles/cauce-dark.json",
  "/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) {
    await cache.delete(key);
  }
}

async function networkFirst(request, cacheName, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallback) return (await caches.match(fallback)) ?? Response.error();
    return Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok)
    (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        trim(cacheName, MAX_TILES);
      }
      return response;
    })
    .catch(() => cached ?? Response.error());
  return cached ?? network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname === "tiles.openfreemap.org") {
    event.respondWith(staleWhileRevalidate(request, TILE_CACHE));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/sin-conexion"));
    return;
  }
  // Last-known map data and place index, so a reload while offline still works.
  if (
    url.pathname === "/api/reports" ||
    url.pathname === "/api/devices" ||
    url.pathname.startsWith("/data/")
  ) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/map/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/seed/")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});
