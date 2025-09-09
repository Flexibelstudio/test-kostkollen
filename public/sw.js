// public/sw.js
// Säker PWA-SW: cachear bara egna filer, tål saknade filer, auto-update via skipWaiting/clients.claim

const STATIC_CACHE_NAME = 'kostloggen-static-v14';
const DYNAMIC_CACHE_NAME = 'kostloggen-dyn-v9';
const MAX_DYNAMIC_ENTRIES = 80;

const URLS_TO_CACHE = [
  '/',               // SPA-fallback
  '/index.html',
  '/manifest.json',
  '/index.css',

  // Ikoner (samma paths som du listade)
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

// Externa värdar vi låter passera (cachas inte av SW)
const BYPASS_HOSTS = [
  'googleapis.com','gstatic.com','firebaseapp.com',
  'firebasestorage.googleapis.com','storage.googleapis.com','appspot.com',
  'identitytoolkit.googleapis.com','securetoken.googleapis.com',
  'firebasedatabase.app','apis.google.com','esm.sh','cdn.tailwindcss.com'
];

// Egna paths att hoppa över (t.ex. Netlify functions)
const SAME_ORIGIN_BYPASS_PATH_PREFIXES = ['/.netlify/','/api/'];

const STATIC_ASSET_REGEX = /\.(?:js|mjs|css|ico|png|jpg|jpeg|gif|webp|svg|woff2?)$/i;

// --- uppdatera direkt när ny SW finns ---
self.addEventListener('message', (e) => {
  if (e?.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE_NAME);
    // Lägg till varje fil separat så inte EN miss slår ut hela install
    for (const u of URLS_TO_CACHE) {
      try {
        await cache.add(new Request(u, { cache: 'reload' }));
      } catch (err) {
        console.warn('SW install: hoppar över (saknas eller 404?):', u, err);
      }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((n) =>
      [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME].includes(n) ? undefined : caches.delete(n)
    ));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';

  // Låt externa värdar gå direkt (ingen SW-cache)
  if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;

  // HTML/navigering: network-first, offline fallback till index.html
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');
  if (isHTML) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(STATIC_CACHE_NAME);
        try { await cache.put('/index.html', res.clone()); } catch {}
        try { await cache.put('/', res.clone()); } catch {}
        return res;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Samma origin: cacha bara tydliga statiska assets (hashade bundles etc)
  if (url.origin === self.location.origin) {
    if (SAME_ORIGIN_BYPASS_PATH_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

    const isStaticAsset = STATIC_ASSET_REGEX.test(url.pathname) || url.pathname.startsWith('/assets/');
    if (isStaticAsset) {
      event.respondWith(cacheFirst(req));
      return;
    }
    // Övriga GET (API/SSR etc) går direkt till nätet
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
