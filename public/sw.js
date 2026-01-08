// public/sw.js
// Säker PWA-SW: auto-update, rensar gamla caches, cachear bara säkra assets,
// nätet-först för HTML, bypass på externtrafik (Firebase m.fl.).

const VERSION = '2026-01-08-1';                // <-- bumpa vid nästa release
const STATIC_CACHE_NAME  = 'kostloggen-static-v33'; // <-- bumpa vid nästa release
const DYNAMIC_CACHE_NAME = 'kostloggen-dyn-v29';    // <-- bumpa vid nästa release
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
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { return; }

  const n = data.notification || {};
  const title = n.title || 'Ny notis';
  const options = {
    body:  n.body || '',
    icon:  n.icon  || '/icons/icon-192x192.png',
    badge: n.badge || '/icons/badge-96x96.png',
    data:  n.data  || { url: '/' },
    tag:   'kostloggen-notification'
  };

  const p = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(clients => {
      const inForeground = clients.some(c => c.visibilityState === 'visible' && c.focused);
      if (inForeground) {
        clients.forEach(c => {
          if (c.visibilityState === 'visible') {
            c.postMessage({ message: 'push-received-in-foreground', notification: { title, body: options.body } });
          }
        });
        return;
      }
      return self.registration.showNotification(title, options);
    });

  event.waitUntil(p);
});

self.addEventListener('notificationclick', (event) => {
  const urlToOpen = event.notification?.data?.url || '/';
  event.notification?.close();

  const p = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(clients => {
      const target = new URL(urlToOpen, self.location.origin);
      const existing = clients.find(c => {
        const cu = new URL(c.url);
        return cu.pathname === target.pathname && cu.search === target.search;
      });
      if (existing) return existing.focus();
      return self.clients.openWindow(urlToOpen);
    });

  event.waitUntil(p);
});
