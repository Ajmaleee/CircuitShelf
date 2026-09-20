/* Parts — offline shell.
   Cache-first for the app, network-first for everything else, and every
   navigation falls back to the cached app so the PWA never shows a dead page. */

const VERSION = "parts-v6";
const SHELL = [
  "./", "./index.html", "./styles.css", "./app.js", "./404.html", "./manifest.json",
  "./icon-192.png", "./icon-512.png",
  "./icon-maskable-192.png", "./icon-maskable-512.png",
  "./apple-touch-icon.png", "./favicon-32.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Firebase, Google SDK and any other origin: straight to the network.
  if (url.origin !== self.location.origin) return;

  // Navigations always resolve: live page, else cached app, else the 404 card.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("./index.html", copy));
          }
          return res;
        })
        .catch(() =>
          caches.match("./index.html")
            .then((r) => r || caches.match("./"))
            .then((r) => r || caches.match("./404.html"))
            .then((r) => r || new Response(
              "<!doctype html><meta http-equiv='refresh' content='0;url=/'>",
              { headers: { "Content-Type": "text/html" } }
            ))
        )
    );
    return;
  }

  // Same-origin assets: serve from cache, refresh in the background.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
