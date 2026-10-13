const BASE = '/poke-study/';
const SHELL_CACHE = 'poke-study-shell-v1';
const DATA_CACHE = 'poke-study-data-v1';
const IMAGE_CACHE = 'poke-study-images-v1';
const CORE = [BASE, BASE + 'index.html', BASE + 'data/pokemon.json', BASE + 'manifest.webmanifest', BASE + 'poke-study.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => ![SHELL_CACHE, DATA_CACHE, IMAGE_CACHE].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/data/pokemon.json')) {
      event.respondWith(
        fetch(request).then(response => {
          if (response.ok) caches.open(DATA_CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        }).catch(() => caches.match(request))
      );
      return;
    }
    if (url.pathname.startsWith(BASE)) {
      event.respondWith(
        caches.match(request).then(cached => cached || fetch(request).then(response => {
          if (response.ok) caches.open(SHELL_CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        }).catch(() => caches.match(BASE + 'index.html')))
      );
      return;
    }
  }

  if (request.destination === 'image' && (url.hostname === 'raw.githubusercontent.com' || url.hostname === 'pokeapi.co')) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok || response.type === 'opaque') {\n            await cache.put(request, response.clone());\n            const keys = await cache.keys();\n            if (keys.length > 250) await cache.delete(keys[0]);\n          }
          return response;
        } catch (error) {
          const fallback = await cache.match(request);
          if (fallback) return fallback;
          throw error;
        }
      })
    );
  }
});
