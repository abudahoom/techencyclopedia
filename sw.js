/* The Tech Encyclopedia — offline support.
   Pages: network first (so updates show up), cached copy when offline.
   Photos from Wikimedia: cached as you view them. The PDF: cached after the first download. */
const VERSION = 'te-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const MAX_PHOTOS = 600;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trimPhotos(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PHOTOS; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname.endsWith('wikipedia.org') || url.hostname.endsWith('wikimedia.org')) {
    e.respondWith(caches.open(VERSION + '-photos').then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        cache.put(req, res.clone()).then(() => trimPhotos(cache));
        return res;
      } catch (err) { return Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return (await cache.match(req, {ignoreSearch: true})) ||
             (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
    }
  })());
});
