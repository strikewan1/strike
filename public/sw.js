// Minimal PWA service worker.
// Strategy:
// - Pass-through everything that could break uploads: API, POST/PUT/PATCH,
//   cross-origin requests, /_next/, auth endpoints
// - Only cache static GET assets that are same-origin
// - HTML navigations: network-first with offline fallback
//
// IMPORTANT: this SW should NEVER intercept anything that could affect
// mutations or file uploads. "Load failed" errors in production were
// caused by this SW catching fetches it shouldn't have.

const CACHE_VERSION = "strike-v4";
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

function shouldBypass(event) {
  const url = new URL(event.request.url);

  // Always bypass non-GET (POST/PUT/PATCH/DELETE) — these are mutations/uploads
  if (event.request.method !== "GET") return true;

  // API routes — always pass through
  if (url.pathname.startsWith("/api/")) return true;

  // Next.js internals — always pass through
  if (url.pathname.startsWith("/_next/")) return true;

  // Cross-origin requests — never cache third-party responses
  if (url.host !== self.location.host) return true;

  // Static assets — let them pass through (Next handles caching via headers)
  if (url.pathname === "/sw.js") return true;
  if (url.pathname === "/manifest.json") return true;
  if (url.pathname === "/icon.svg") return true;

  // Bypass anything with credentials or non-default mode
  if (event.request.credentials !== "same-origin") return true;

  return false;
}

self.addEventListener("fetch", (event) => {
  // Default: pass through. Only respondWith when we have a clear strategy.
  if (shouldBypass(event)) return;

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
