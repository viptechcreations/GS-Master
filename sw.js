const CACHE_NAME = 'gs-master-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './articles.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

const OPTIONAL_DATA = [
  './data/constitution.json',
  './data/pdfs.json',
  './data/notes/polity.json'
];

// Install: Cache core app shell safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        [...CORE_ASSETS, ...OPTIONAL_DATA].map((url) =>
          cache.add(url).catch(() => null)
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch Strategy:
// - HTML & JSON: Network-first (fresh GitHub updates when online, instant offline fallback)
// - Icons/Fonts/Other GET assets: Cache-first with background update
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin requests except fonts/CDNs if needed
  const isSameOrigin = url.origin === self.location.origin;
  const isDataOrHtml =
    req.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname === '/';

  // Don't cache large PDFs aggressively unless opened
  if (isSameOrigin && url.pathname.endsWith('.pdf')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  if (isDataOrHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
