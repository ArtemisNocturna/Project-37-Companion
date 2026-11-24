// Project 37 DEV-companion: zorgt dat de app ook zonder internet opent.
// Bij een nieuwe versie van de app: VERSIE ophogen.
const VERSIE = "p37-companion-dev-1.2-dev.3";
const BESTANDEN = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "stats.js",
  "jszip.min.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/app-192.png",
  "icons/app-512.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSIE).then((c) => c.addAll(BESTANDEN)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // Alleen eigen oude dev-versies weggooien, niet die van de echte app
      Promise.all(keys.filter((k) => k !== VERSIE && k.startsWith("p37-companion-dev-"))
        .map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Eerst online proberen (dan krijg je updates), anders de bewaarde versie.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Alleen bestanden van de dev-companion zelf
  if (!new URL(event.request.url).pathname.includes("/dev/")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === location.origin) {
          const copy = response.clone();
          caches.open(VERSIE).then((c) => c.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true }).then(
          (hit) => hit || caches.match("index.html")
        )
      )
  );
});
