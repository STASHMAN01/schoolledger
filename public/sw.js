// Crechely service worker. Deliberately tiny.
//
// It does ONE thing: when a page can't be fetched because the device is
// offline, show /offline.html instead of the browser's dinosaur page.
//
// It never stores pages, API responses, or anything else from the app.
// Tablets are shared and the app holds children's and families' personal
// and financial information, so nothing from a signed-in session may be
// written to the device's cache. Only the offline page itself is cached.
//
// If you add anything to PRECACHE it must also be a public path
// (src/lib/publicPaths.ts); publicPaths.test.ts checks this.
const CACHE = "crechely-offline-v1";
const PRECACHE = ["/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Page navigations only. Everything else (scripts, images, API calls,
  // PDFs) goes straight to the network, untouched.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const offline = await caches.match("/offline.html");
      return (
        offline ||
        new Response("You're offline. Check your connection and try again.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    })
  );
});
