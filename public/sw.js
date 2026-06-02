// ─── sw.js — Nexus Justice v4.0 Hybrid PWA Service Worker ───────────────────
// Caches app shell for offline use
// Does NOT cache AI — Gemma 3n runs server-side via Google AI Studio
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'nexus-v5-shell';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Install: cache app shell
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, cache-first for app shell
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept API calls or WebLLM model downloads
  if (url.pathname.startsWith('/api/') ||
      url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('esm.run') ||
      url.hostname.includes('huggingface.co') ||
      e.request.method !== 'GET') {
    return;
  }

  // For navigation requests: try network, fall back to cached index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }

  // For assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Handle self-destruct message (from old sw cleanup logic)
self.addEventListener('message', e => {
  if (e.data?.type === 'SW_SELF_DESTRUCT') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
