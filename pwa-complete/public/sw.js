// NaijaMarket Intel - Service Worker v2.0
// Comprehensive PWA support: offline, caching, push notifications, background sync

const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `naijamarket-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';
const API_CACHE_NAME = `naijamarket-api-${CACHE_VERSION}`;

// Core assets to cache immediately on install
const CORE_ASSETS = [
  '/',
  '/offline',
  '/prices',
  '/markets',
  '/alerts',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API routes that should be cached with network-first strategy
const CACHEABLE_API_ROUTES = [
  '/api/markets',
  '/api/items',
  '/api/categories',
  '/api/prices/latest'
];

// Routes that should never be cached
const NO_CACHE_ROUTES = [
  '/api/auth',
  '/api/otp',
  '/api/alerts/create',
  '/api/subscription'
];

// Cache duration in milliseconds
const CACHE_DURATION = {
  static: 7 * 24 * 60 * 60 * 1000,  // 7 days for static assets
  api: 5 * 60 * 1000,               // 5 minutes for API data
  prices: 2 * 60 * 1000             // 2 minutes for price data (fresher)
};

// ============================================================================
// INSTALL EVENT - Cache core assets
// ============================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Core assets cached, activating immediately');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache core assets:', error);
      })
  );
});

// ============================================================================
// ACTIVATE EVENT - Clean up old caches
// ============================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v' + CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('naijamarket-') && name !== CACHE_NAME && name !== API_CACHE_NAME;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// ============================================================================
// FETCH EVENT - Handle all network requests
// ============================================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Skip routes that should never be cached
  if (NO_CACHE_ROUTES.some(route => url.pathname.startsWith(route))) {
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }
  
  // Handle page navigation
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  
  // Default: network first with cache fallback
  event.respondWith(networkFirstWithCacheFallback(request));
});

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

// Handle API requests with network-first, cache fallback
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isPriceData = url.pathname.includes('/prices');
  const cacheDuration = isPriceData ? CACHE_DURATION.prices : CACHE_DURATION.api;
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone response before caching
      const responseToCache = networkResponse.clone();
      
      // Cache in background
      caches.open(API_CACHE_NAME).then((cache) => {
        // Add timestamp header for cache expiry
        const headers = new Headers(responseToCache.headers);
        headers.set('sw-cache-time', Date.now().toString());
        
        const cachedResponse = new Response(responseToCache.body, {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers: headers
        });
        
        cache.put(request, cachedResponse);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for API, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Check if cache is still valid
      const cacheTime = parseInt(cachedResponse.headers.get('sw-cache-time') || '0');
      const isExpired = Date.now() - cacheTime > cacheDuration;
      
      if (!isExpired) {
        console.log('[SW] Returning valid cached API response');
        return cachedResponse;
      } else {
        console.log('[SW] Cache expired, returning stale data with warning');
        // Return stale data but add header to indicate it's stale
        const headers = new Headers(cachedResponse.headers);
        headers.set('sw-stale-data', 'true');
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: headers
        });
      }
    }
    
    // No cache available, return error response
    return new Response(
      JSON.stringify({
        error: 'You appear to be offline',
        message: 'Please check your internet connection and try again.',
        offline: true,
        cached: false
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Update cache in background (stale-while-revalidate)
    fetchAndCache(request);
    return cachedResponse;
  }
  
  return fetchAndCache(request);
}

// Handle page navigation with network-first, offline fallback
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful page responses
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation failed, trying cache:', request.url);
    
    // Try cached page
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page
    const offlineResponse = await caches.match(OFFLINE_URL);
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Ultimate fallback - inline offline page
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - NaijaMarket Intel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 20px;
    }
    .container { max-width: 400px; }
    .icon { font-size: 80px; margin-bottom: 24px; }
    h1 { font-size: 28px; margin-bottom: 16px; color: #22c55e; }
    p { color: #a0a0a0; line-height: 1.6; margin-bottom: 24px; }
    button {
      background: #22c55e;
      color: #000;
      border: none;
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    button:hover { background: #16a34a; transform: scale(1.02); }
    button:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📴</div>
    <h1>You're Offline</h1>
    <p>No wahala! Check your internet connection and try again. Your cached prices are still available.</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Network first with cache fallback (default strategy)
async function networkFirstWithCacheFallback(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Network error', { status: 503 });
  }
}

// Fetch and cache helper
async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', request.url, error);
    throw error;
  }
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', 
    '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webp'
  ];
  return staticExtensions.some(ext => pathname.endsWith(ext)) || 
         pathname.startsWith('/icons/') ||
         pathname.startsWith('/_next/static/');
}

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'NaijaMarket Intel',
    body: 'You have a new price alert!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'price-alert',
    data: {
      url: '/alerts'
    }
  };
  
  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = { ...data, ...pushData };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/badge-72x72.png',
    tag: data.tag || 'naijamarket-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
    actions: data.actions || [
      { action: 'view', title: 'View', icon: '/icons/action-view.png' },
      { action: 'dismiss', title: 'Dismiss', icon: '/icons/action-dismiss.png' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
  // Analytics tracking could go here
});

// ============================================================================
// BACKGROUND SYNC
// ============================================================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'sync-alerts') {
    event.waitUntil(syncAlerts());
  }
  
  if (event.tag === 'sync-prices') {
    event.waitUntil(syncPrices());
  }
});

// Sync alerts when back online
async function syncAlerts() {
  try {
    const response = await fetch('/api/alerts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      console.log('[SW] Alerts synced successfully');
    }
  } catch (error) {
    console.error('[SW] Failed to sync alerts:', error);
  }
}

// Prefetch latest prices when back online
async function syncPrices() {
  try {
    const response = await fetch('/api/prices/latest');
    
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put('/api/prices/latest', response);
      console.log('[SW] Prices synced successfully');
    }
  } catch (error) {
    console.error('[SW] Failed to sync prices:', error);
  }
}

// ============================================================================
// PERIODIC BACKGROUND SYNC (for price updates)
// ============================================================================
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync event:', event.tag);
  
  if (event.tag === 'price-updates') {
    event.waitUntil(fetchLatestPrices());
  }
});

async function fetchLatestPrices() {
  try {
    const response = await fetch('/api/prices/latest');
    
    if (response.ok) {
      const data = await response.json();
      const cache = await caches.open(API_CACHE_NAME);
      cache.put('/api/prices/latest', new Response(JSON.stringify(data)));
      
      // Notify user if there are significant price changes
      if (data.alerts && data.alerts.length > 0) {
        self.registration.showNotification('Price Alert', {
          body: `${data.alerts.length} price changes detected!`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: 'price-update',
          data: { url: '/prices' }
        });
      }
    }
  } catch (error) {
    console.error('[SW] Periodic price fetch failed:', error);
  }
}

// ============================================================================
// MESSAGE HANDLING (for client-SW communication)
// ============================================================================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
      event.ports[0].postMessage({ cleared: true });
      break;
      
    case 'CACHE_URLS':
      caches.open(CACHE_NAME).then((cache) => {
        cache.addAll(payload.urls);
      });
      break;
      
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

console.log('[SW] Service Worker loaded - v' + CACHE_VERSION);
