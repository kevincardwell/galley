/*
 * Galley service worker.
 *
 * Deliberately conservative: this app is a database front end, so serving stale pages would be
 * worse than showing nothing. Pages and API calls always go to the network; only the build's
 * static assets are cached, plus one offline page to explain what happened.
 */
const VERSION = "galley-v1";
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|webp|jpg|jpeg|ico|woff2?)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build output: serve from cache, fill it on first use.
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ??
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
      ),
    );
    return;
  }

  // Page navigations: network, falling back to the offline page when there is none.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error())));
  }
});
