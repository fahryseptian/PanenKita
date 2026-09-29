/* PanenKita service worker — katalog panen KWT.
 *
 * Strategi:
 * - Navigasi (document): network-first, fallback ke cache, lalu /offline.html.
 * - Aset statis (_next/static, icon, font, gambar): stale-while-revalidate.
 * - Request lintas origin (analytics dsb): tidak pernah di-cache.
 * - API & halaman dinamis: tidak pernah di-cache.
 *
 * Naikkan VERSION untuk mengganti cache lama saat deploy berikutnya.
 */
const VERSION = "v1";
const SHELL_CACHE = `panenkita-shell-${VERSION}`;
const RUNTIME_CACHE = `panenkita-runtime-${VERSION}`;
const OFFLINE_URL = "/offline.html";

// Aset inti yang diprecache saat instalasi.
const PRECACHE_URLS = [OFFLINE_URL, "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("panenkita-") && !name.endsWith(`-${VERSION}`))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/icon" ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Hanya GET; request lain (POST order, dsb) langsung ke jaringan.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // analytics, S3, dsb: biarkan jaringan
  if (url.pathname.startsWith("/api/")) return; // API selalu fresh

  // Navigasi: network-first dengan fallback cache lalu halaman offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return (
            offline ??
            new Response("Offline", { status: 503, statusText: "Offline" })
          );
        }
      })(),
    );
    return;
  }

  // Aset statis: stale-while-revalidate (cache dulu kalau ada, segarkan di belakang).
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      })(),
    );
  }
});
