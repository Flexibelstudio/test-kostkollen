// A name for our cache
const CACHE_NAME = 'kostloggen-cache-v2';

// The list of files to cache on service worker installation
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.css',

  // Icons from the manifest
  '/favicon.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',

  // CDN scripts and modules from importmap
  'https://cdn.tailwindcss.com',
  "https://esm.sh/react@^19.1.0",
  "https://esm.sh/react-dom@^19.1.0/client",
  "https://esm.sh/react@^19.1.0/jsx-runtime",
  "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js",
  "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js",
  "https://esm.sh/@google/genai@^1.9.0",
  "https://esm.sh/async-mutex@^0.5.0",
  "https://esm.sh/@zxing/browser@^0.1.5",
  "https://esm.sh/lucide-react@^0.400.0"
];

// Install event: Open a cache and add all of the app shell files to it
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(error => {
        console.error('Failed to cache app shell during install:', error);
      })
  );
});

// Activate event: Clean up any old caches that are no longer needed
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: Intercept network requests and serve from cache if available
self.addEventListener('fetch', (event) => {
  // We only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // If the resource is in the cache, return it.
        if (cachedResponse) {
          return cachedResponse;
        }

        // If it's not in the cache, fetch it from the network.
        // We don't cache Firestore or other API calls here.
        // Firestore's SDK handles its own offline persistence.
        return fetch(event.request);
      })
      .catch(error => {
        console.error('Fetch error:', error);
        // For navigation requests (e.g., refreshing the page offline),
        // if the fetch fails, fall back to the cached index.html.
        // This is crucial for SPA functionality offline.
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// Push Notification Event Listener
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  
  const data = event.data ? event.data.json() : {};

  const title = data.title || 'Kostloggen';
  const options = {
    body: data.body || 'Dags att logga en måltid!',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png', // Often used in the notification tray on Android
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(
    event.notification.data?.url || '/',
    self.location.origin
  ).href;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;

    // Check if there's a focused window client first.
    for (const client of windowClients) {
      if (client.focused) {
        matchingClient = client;
        break;
      }
    }

    // If not, check for any visible window client.
    if (!matchingClient) {
      for (const client of windowClients) {
         if (client.visibilityState === "visible") {
            matchingClient = client;
            break;
         }
      }
    }
    
    // If still no matching client, take the first available client.
    if (!matchingClient && windowClients.length > 0) {
        matchingClient = windowClients[0];
    }


    if (matchingClient) {
      // If we found an open tab, navigate it to the URL and focus it.
      return matchingClient.navigate(urlToOpen).then((client) => client?.focus());
    } else {
      // If we didn't find an open tab, open a new one.
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});