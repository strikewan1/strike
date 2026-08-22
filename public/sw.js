// Minimal PWA service worker.
// Strategy:
// - Bypass everything that's not same-origin HTML (API routes, Supabase, etc.)
// - For HTML navigations: try network, fall back to a minimal offline shell
// - Static assets: stale-while-revalidate
// Never call respondWith unless we have a valid response — this is what was
// triggering the "fetchEvent.respondWith received an error: Load failed"
// console message in production.

const CACHE_VERSION = "strike-v3";
const OFFLINE_SHELL = "/";

self.addEventListener("install", () => {
  return self.skipWaiting();
});

self.addEventListener("activate", () => {
  return (async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
    );
    await self.clients.claim();
  })();
});

function shouldBypass(url) {
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/_next/")) return true;
  if (url.host !== self.location.host) return true;
  if (url.pathname === "/sw.js") return true;
  if (url.pathname === "/manifest.json") return true;
  if (url.pathname === "/icon.svg") return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Default: let the browser handle it normally
  if (shouldBypass(url)) return;
  if (event.request.method !== "GET") return;

  // Navigation requests (HTML pages): network-first with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(event.request, copy));
          }
          return response;
        } catch (_) {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const shell = await caches.match(OFFLINE_SHELL);
          if (shell) return shell;
          return new Response(
            "<h1>Sin conexion</h1><p>Volve a intentar cuando tengas internet.</p>",
            {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            },
          );
        }
      })(),
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      const networkPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => null);

      if (cached) return cached;
      const network = await networkPromise;
      if (network) return network;
      return new Response("", { status: 504 });
    })(),
  );
});
