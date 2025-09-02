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
  'https://esm.sh/react@18.2.0',
  'https://esm.sh/react-dom@18.2.0/client',
  'https://esm.sh/react@18.2.0/jsx-runtime',
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

self.addEventListener('push', (event) => {
  console.log('[SW] Push-händelse mottagen.', event.data ? event.data.text() : 'Ingen payload.');

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "Ny Notis", body: event.data.text() };
  }

  const notification = payload.notification || payload;
  const title = notification.title || "Kostloggen";
  const options = {
    body: notification.body || "Du har fått en ny notis!",
    icon: notification.icon || '/icons/icon-192x192.png',
    badge: notification.badge || '/icons/badge-96x96.png',
    data: payload.data || { url: '/' }
  };
  
  const promiseChain = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(windowClients => {
    let clientIsVisible = false;
    for (const client of windowClients) {
      if (client.visibilityState === "visible") {
        clientIsVisible = true;
        client.postMessage({
          message: 'push-received-in-foreground',
          notification: { title, ...options }
        });
        break;
      }
    }
    
    if (clientIsVisible) {
      console.log('[SW] Appen är i förgrunden, skickar meddelande istället för notis.');
      return;
    }

    console.log('[SW] Appen är i bakgrunden, visar systemnotis.');
    return self.registration.showNotification(title, options);
  });

  event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          const targetUrl = new URL(url, self.location.origin).href;
          if (client.url !== targetUrl && 'navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// (valfritt) hantera stängning
self.addEventListener('notificationclose', () => {
  // plats för ev. analytics
});