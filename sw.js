/* Путь к квартире: офлайн. Сначала отдаём из кэша (открывается сразу), в фоне обновляем файлы. */
const VERSION = 'put-20261117211626';
const SHELL = ['./', 'index.html', 'styles.css', 'core.js', 'game.js', 'ui.js', 'store.js', 'app.js', 'firebase-config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // на tiil1.github.io живут и другие сайты: удаляем только свои старые кэши
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('put-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Firebase и Google идут мимо кэша
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || c.match('index.html');
  }));
});
