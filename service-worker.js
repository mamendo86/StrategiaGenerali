/*
 * Service worker — "La tua strategia, costruita su di te" (Generali)
 * Stessa strategia adottata nel Compositore di Portafoglio:
 *  - index.html (app shell): network-first, così ogni aggiornamento del
 *    file viene sempre servito subito, senza dover incrementare
 *    manualmente CACHE_NAME a ogni modifica. Fallback alla cache solo
 *    se la rete non è disponibile (uso offline).
 *  - Asset statici (manifest, icone, librerie CDN): cache-first, per
 *    velocità e funzionamento offline.
 *  - Qualsiasi altra richiesta (dati dinamici, es. future sincronizzazioni):
 *    sempre in rete, mai in cache, per evitare dati non aggiornati tra
 *    dispositivi.
 */

const CACHE_NAME = "strategia-cliente-static-v1";

const STATIC_ASSETS = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {}) // non bloccare l'installazione se una risorsa CDN non risponde
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isStaticAsset(request) {
  const url = request.url;
  if (STATIC_ASSETS.some((asset) => url === asset || url.endsWith(asset))) return true;
  if (url.endsWith(".png") || url.endsWith("manifest.json")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") {
    // richieste non-GET: sempre in rete, mai intercettate
    return;
  }

  const isNavigation =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    // App shell (index.html): network-first
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  if (isStaticAsset(req)) {
    // Asset statici: cache-first
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // Tutto il resto (dati dinamici, future sincronizzazioni): sempre in rete
  event.respondWith(fetch(req));
});
