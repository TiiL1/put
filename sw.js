/* Путь к квартире: офлайн. Сначала отдаём из кэша (открывается сразу), в фоне обновляем файлы. */
const VERSION = 'put-20261118024256';
const SHELL = ['./', 'index.html', 'styles.css', 'core.js', 'game.js', 'ui.js', 'store.js', 'app.js', 'firebase-config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'badge-72.png'];
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

// смена в шторке: кнопки Перерыв, Продолжить и Закончил пишут событие в ящик (имя не put-, его не стирает activate),
// уведомление сразу показывает новое состояние, а страница применит события к таймеру, когда откроется
const INBOX = 'putinbox';
const hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
self.addEventListener('notificationclick', e => {
  const n = e.notification, a = e.action, data = n.data || {};
  n.close();
  e.waitUntil((async () => {
    // только окна этого приложения: на tiil1.github.io открыты и другие сайты
    const wins = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(w => w.url.startsWith(self.registration.scope));
    if (a === 'pause' || a === 'resume' || a === 'stop') {
      const t = Date.now(), c = await caches.open(INBOX);
      await c.put(new Request('./inbox/' + t + '-' + a), new Response(JSON.stringify({ a, t, start: data.start })));
      const title = a === 'stop' ? 'Смена закончена' : a === 'pause' ? 'Перерыв' : (data.title || 'Смена идёт');
      const body = a === 'stop' ? 'Нажми, чтобы внести сумму из Яндекс Про' : a === 'pause' ? 'Перерыв с ' + hhmm(t) : 'Снова в пути с ' + hhmm(t);
      const actions = a === 'stop' ? [] : a === 'pause' ? [{ action: 'resume', title: 'Продолжить' }, { action: 'stop', title: 'Закончил' }] : [{ action: 'pause', title: 'Перерыв' }, { action: 'stop', title: 'Закончил' }];
      await self.registration.showNotification(title, { tag: n.tag || 'put-shift', body, actions, silent: true, icon: 'icon-192.png', badge: 'badge-72.png', timestamp: data.start, data: Object.assign({}, data, { state: a }) });
      wins.forEach(w => w.postMessage({ put: 'inbox' }));
      return;
    }
    // нажатие на само уведомление: открыть приложение, после конца смены сразу лист смены с часами таймера
    if (wins.length) { await wins[0].focus(); wins[0].postMessage({ put: data.state === 'stop' ? 'log' : 'inbox' }); return; }
    await self.clients.openWindow(data.state === 'stop' ? './?do=stop' : './');
  })());
});
