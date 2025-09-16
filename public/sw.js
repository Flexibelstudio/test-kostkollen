// public/sw.js
// Säker PWA-SW: auto-update, rensar gamla caches, cachear bara säkra assets,
// nätet-först för HTML, bypass på externtrafik (Firebase m.fl.).

const VERSION = '2025-09-12-2';

// BUMPA när du vill tvinga alla att få ny SW direkt
const STATIC_CACHE_NAME  = 'kostloggen-static-v15';
const DYNAMIC_CACHE_NAME = 'kostloggen-dyn-v10';
const MAX_DYNAMIC_ENTRIES = 80;

// Minimalt precache för offline-fallback (cacha inte massor här)
const URLS_TO_CACHE = [
  '/',               // SPA-fallback
  '/index.html',
  '/manifest.json',
  '/index.css',

  // Ikoner
  '/favicon.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

// Externa värdar vi ALDRIG cachear via SW (låter browsern hantera)
const BYPASS_HOSTS = [
  'googleapis.com','gstatic.com','firebaseapp.com',
  'firebasestorage.googleapis.com','storage.googleapis.com','appspot.com',
  'identitytoolkit.googleapis.com','securetoken.googleapis.com',
  'firebasedatabase.app','apis.google.com','esm.sh','cdn.tailwindcss.com'
];

// Egna paths att hoppa över (ex. Netlify functions)
const SAME_ORIGIN_BYPASS_PATH_PREFIXES = ['/.netlify/','/api/'];

// Endast tydliga statiska assets cacheas via SW
const STATIC_ASSET_REGEX = /\.(?:js|mjs|css|ico|png|jpg|jpeg|gif|webp|svg|woff2?)$/i;

// --- Auto update: ta över direkt när ny SW finns ---
self.addEventListener('message', (e) => {
  if (e?.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  // Hoppa direkt till activate (ingen väntan)
  self.skipWaiting();

  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE_NAME);
    for (const u of URLS_TO_CACHE) {
      try {
        // Hämtar färskt
        await cache.add(new Request(u, { cache: 'reload' }));
      } catch (err) {
        console.warn('[SW] install: hoppar över (saknas/404?):', u, err);
      }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Rensa ALLA äldre caches (behåll ENDAST nuvarande)
    const keep = new Set([STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME]);
    const names = await caches.keys();
    await Promise.all(names.map((n) => keep.has(n) ? undefined : caches.delete(n)));

    // (valfritt) navigation preload
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }

    await self.clients.claim();
    console.log('[SW] activated', VERSION);
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';

  // Låt externa värdar gå direkt (ingen SW-cache)
  if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;

  // HTML / navigering → nätet först, fallback cache (index.html)
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');
  if (isHTML) {
    event.respondWith((async () => {
      try {
        // Säkra att vi inte levererar gammalt HTML pga cache
        const res = await fetch(req, { cache: 'no-store' });
        // Spara en kopia av index.html & "/" för offline
        const cache = await caches.open(STATIC_CACHE_NAME);
        try { await cache.put('/index.html', res.clone()); } catch {}
        try { await cache.put('/',            res.clone()); } catch {}
        return res;
      } catch {
        // Offline-fallback
        return (await caches.match('/index.html')) ||
               (await caches.match('/')) ||
               Response.error();
      }
    })());
    return;
  }

  // Samma origin: cacha ENDAST tydliga statiska assets
  if (url.origin === self.location.origin) {
    // Hoppa över t.ex. /.netlify/ eller /api/
    if (SAME_ORIGIN_BYPASS_PATH_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

    const isStaticAsset =
      STATIC_ASSET_REGEX.test(url.pathname) || url.pathname.startsWith('/assets/');

    if (isStaticAsset) {
      event.respondWith(cacheFirst(req));
      return;
    }
    // Övriga GET (API/SSR etc.) går direkt till nätet
    return;
  }

  // Cross-origin GET: nätet först, fallback cache (cacha inte nya opaque)
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const res = await fetch(request);
  if (res && res.ok && res.type !== 'opaque') {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    await cache.put(request, res.clone());
    await trimCache(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_ENTRIES);
  }
  return res;
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await Promise.all(keys.slice(0, keys.length - maxItems).map((k) => cache.delete(k)));
  }
}

// --- Push Notification Handlers ---

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW] Push event received but no data was sent.');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Error parsing push data as JSON:', e);
    return;
  }

  // The backend payload is nested under a `notification` key.
  const notification = data.notification;
  if (!notification) {
    console.error('[SW] Push data does not contain a "notification" object.');
    return;
  }

  const title = notification.title || 'Ny Notis';
  const options = {
    body: notification.body || '',
    icon: notification.icon || '/icons/icon-192x192.png',
    badge: notification.badge || '/icons/badge-96x96.png',
    data: notification.data || { url: '/' },
    tag: 'kostloggen-notification' // Allows replacing old notifications
  };

  const promise = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(clients => {
    // If the app is in the foreground, don't show a system notification.
    // Instead, send a message to the client to show an in-app toast.
    const isAppInForeground = clients.some(client => client.visibilityState === 'visible' && client.focused);

    if (isAppInForeground) {
      clients.forEach(client => {
        if (client.visibilityState === 'visible') {
           client.postMessage({
             message: 'push-received-in-foreground',
             notification: {
               title: title,
               body: options.body
             }
           });
        }
      });
      console.log('[SW] App is in foreground. Sent message to client instead of showing notification.');
      return Promise.resolve();
    }

    // If app is not in foreground, show the system notification.
    return self.registration.showNotification(title, options);
  });

  event.waitUntil(promise);
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  notification.close(); // Close the notification

  const urlToOpen = notification.data?.url || '/';

  const promise = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(clients => {
    // Check if a window/tab for this app is already open.
    const matchingClient = clients.find(client => {
      // Check if the client's URL is what we want to open.
      const clientUrl = new URL(client.url);
      const targetUrl = new URL(urlToOpen, self.location.origin);
      // Compare pathnames and search params for a more robust match
      return clientUrl.pathname === targetUrl.pathname && clientUrl.search === targetUrl.search;
    });

    if (matchingClient) {
      // If found, focus it.
      return matchingClient.focus();
    } else {
      // If not, open a new window.
      return self.clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promise);
});
