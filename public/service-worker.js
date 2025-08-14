// ====== CACHE ======
const CACHE_NAME = 'kostloggen-cache-v2';

const URLS_TO_CACHE = [
  '/',
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

  // CDN/externa moduler (valfritt att cachea)
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@^19.1.0',
  'https://esm.sh/react-dom@^19.1.0/client',
  'https://esm.sh/react@^19.1.0/jsx-runtime',
  'https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js',
  'https://esm.sh/@google/genai@^1.9.0',
  'https://esm.sh/async-mutex@^0.5.0',
  'https://esm.sh/@zxing/browser@^0.1.5',
  'https://esm.sh/lucide-react@^0.400.0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS_TO_CACHE))
      .catch(err => console.error('SW install: cache misslyckades', err))
  );
});

self.addEventListener('activate', (event) => {
  const keep = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.map(n => keep.includes(n) ? undefined : caches.delete(n)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request);
    }).catch(err => {
      // Fallback för SPA vid offline navigering
      if (event.request.mode === 'navigate') return caches.match('/index.html');
      throw err;
    })
  );
});

// ====== PUSH NOTIFICATIONS ======

// Robust tolkning av inkommande payload
function parsePush(event) {
  let payload = {};
  try {
    // Försök läsa JSON
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    // Som fallback, försök tolka som text
    try { payload = JSON.parse(event.data.text()); } catch (_e) { payload = {}; }
  }

  const n = payload.notification || {};
  const d = payload.data || payload; // stöd för platt struktur

  const title = payload.title || n.title || 'Kostloggen';
  const body  = payload.body  || n.body  || 'Du har en ny notis!';
  const icon  = payload.icon  || n.icon  || '/icons/icon-192x192.png';
  const url   = d.url || '/';

  // valfria actions (om ni skickar actions i data)
  const actions = d.actions || n.actions || undefined;

  return {
    title,
    options: {
      body,
      icon,
      badge: '/icons/badge-96x96.png',
      data: { url, raw: payload },
      actions
    }
  };
}

// Visa notis vid push när sidan är i bakgrunden/stängd
self.addEventListener('push', (event) => {
  console.log('[SW] Push mottagen');
  const { title, options } = parsePush(event);
  event.waitUntil(self.registration.showNotification(title, options));
});

// Öppna/fokusera appen vid klick på notisen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      // Fokusera en redan öppen flik om möjligt
      for (const c of clientsArr) {
        try {
          if (c.url && c.url.startsWith(self.location.origin)) {
            c.focus();
            // Navigera varsamt om vi vill till en specifik sida
            if (url && url !== '/' && !c.url.endsWith(url)) c.navigate(url);
            return;
          }
        } catch (_) {}
      }
      // Annars öppna en ny
      return clients.openWindow(url);
    })
  );
});

// (valfritt) hantera stängning
self.addEventListener('notificationclose', () => {
  // plats för ev. analytics
});
