// Network-first for the app's own files (so updates arrive on the next open),
// falling back to the cached copy when offline or the network is slow.
const CACHE = 'sticky-notes-v4';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => fetch(u, { cache: 'reload' }).then((r) => (r.ok ? c.put(u, r) : null)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
}

function networkFirst(req) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r) => { if (!settled && r) { settled = true; resolve(r); } };
    const timer = setTimeout(() => caches.match(req).then(finish), 3000);
    fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then((res) => { clearTimeout(timer); put(req, res); finish(res); })
      .catch(() => {
        clearTimeout(timer);
        caches.match(req)
          .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : null))
          .then((hit) => finish(hit || Response.error()));
      });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin === self.location.origin) {
    e.respondWith(networkFirst(req));
  } else {                       // fonts etc.: cache first
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => { put(req, res); return res; }))
    );
  }
});
