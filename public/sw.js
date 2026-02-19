// ============================================================================
// NaijaMarket Intel — Service Worker v2.0
// Caching: Static (cache-first) | API (network-first) | Pages (stale-while-revalidate)
// Push notifications for price alerts
// ============================================================================

const CACHE_VERSION = "nm-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

// Static assets to pre-cache on install
const PRE_CACHE = [
  "/offline",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// ============================================================================
// INSTALL — Pre-cache essential files
// ============================================================================
self.addEventListener("install", (event) => {
  console.log("[SW] Installing v2...");
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRE_CACHE))
      .then(() => self.skipWaiting())
  );
});

// ============================================================================
// ACTIVATE — Clean old caches
// ============================================================================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating v2...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("nm-") && !key.startsWith(CACHE_VERSION))
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================================
// FETCH — Strategy router
// ============================================================================
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, etc.
  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // API calls → network-first with cache fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE, 8000));
    return;
  }

  // Static assets → cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Pages → stale-while-revalidate
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
    return;
  }

  // Everything else → network with cache fallback
  event.respondWith(networkFirst(request, STATIC_CACHE, 5000));
});

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

// Cache-first: Check cache, fallback to network
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

// Network-first: Try network, fallback to cache
async function networkFirst(request, cacheName, timeout = 5000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // If it's a page request, show offline page
    if (request.headers.get("accept")?.includes("text/html")) {
      return caches.match("/offline") || new Response("Offline", { status: 503 });
    }

    return new Response(JSON.stringify({ error: "offline", message: "No network connection" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Stale-while-revalidate: Return cache immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Return cached version immediately if available, otherwise wait for network
  if (cached) {
    // Fire-and-forget background update
    fetchPromise;
    return cached;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;

  // Offline fallback
  return caches.match("/offline") || new Response("Offline", { status: 503 });
}

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

self.addEventListener("push", (event) => {
  console.log("[SW] Push received");

  let data = {
    title: "NaijaMarket Intel",
    body: "You have a new price alert!",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: "price-alert",
    url: "/dashboard/price-alerts",
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    console.log("[SW] Push parse error, using defaults");
  }

  const options = {
    body: data.body,
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/icon-72x72.png",
    tag: data.tag || "price-alert",
    vibrate: [200, 100, 200],
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || "/dashboard/price-alerts",
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: "view", title: "View Alert", icon: "/icons/icon-72x72.png" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification click:", event.action);
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/dashboard/price-alerts";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes("naijamarket") && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(targetUrl);
    })
  );
});

// ============================================================================
// BACKGROUND SYNC (for offline submissions)
// ============================================================================

self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync:", event.tag);

  if (event.tag === "sync-alerts") {
    event.waitUntil(syncPendingAlerts());
  }
});

async function syncPendingAlerts() {
  try {
    const cache = await caches.open(API_CACHE);
    // Could store pending alert creations here and replay them
    console.log("[SW] Syncing pending alert operations...");
  } catch (e) {
    console.error("[SW] Sync failed:", e);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?.*)?$/i.test(pathname);
}

// Message handler for cache management from the app
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_CACHE") {
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("nm-")).map((k) => caches.delete(k)))
    ).then(() => {
      event.ports[0]?.postMessage({ result: "caches_cleared" });
    });
  }

  if (event.data?.type === "CACHE_URLS") {
    const urls = event.data.urls || [];
    caches.open(PAGE_CACHE).then((cache) => cache.addAll(urls));
  }
});
