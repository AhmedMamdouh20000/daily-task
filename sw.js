/* Service Worker: يشغّل التطبيق بدون إنترنت. شبكة أولًا للكود، كاش أولًا للأصول الثقيلة. */
const V = 'mk-v3.0.0', CORE = `${V}-core`, MEDIA = `${V}-media`;
const SHELL = ['./', 'index.html', 'config.js', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'assets/fonts/readex-arabic.woff2', 'assets/fonts/readex-latin.woff2', 'assets/fonts/ruqaa.woff2', 'js/vendor/adhan.min.js',
  'js/app.js', 'js/core/util.js', 'js/core/store.js', 'js/core/quick.js', 'js/core/report-core.js', 'js/core/sound.js', 'js/core/notify.js', 'js/core/prayer.js', 'js/core/cloud.js', 'js/core/ics.js',
  'js/ui/ui.js', 'js/ui/arc.js', 'js/ui/onboarding.js', 'js/features/today.js', 'js/features/events.js', 'js/features/money.js', 'js/features/prayer.js', 'js/features/reports.js', 'js/features/alerts.js', 'js/features/more.js'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE); await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    caches.open(MEDIA).then(m => m.add('assets/adhan.mp3')).catch(() => {});   // الأذان بيتحمّل في الخلفية
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => { for (const k of await caches.keys()) if (!k.startsWith(V)) await caches.delete(k); await self.clients.claim(); })());
});

async function ranged(req, res) {
  const r = req.headers.get('range'); if (!r || !res) return res;
  const m = /bytes=(\d*)-(\d*)/.exec(r); if (!m) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength, s = m[1] ? +m[1] : 0, e = m[2] ? Math.min(+m[2], size - 1) : size - 1;
  return new Response(buf.slice(s, e + 1), { status: 206, headers: { 'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${s}-${e}/${size}`, 'Content-Length': String(e - s + 1), 'Accept-Ranges': 'bytes' } });
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/assets/adhan.mp3')) {
    e.respondWith((async () => { const m = await caches.open(MEDIA), hit = await m.match('assets/adhan.mp3'); if (hit) return ranged(req, hit); return fetch(req); })());
    return;
  }
  if (/\.(woff2|png|svg|mp3)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then(h => h || fetch(req).then(r => { const c = r.clone(); caches.open(CORE).then(x => x.put(req, c)); return r; })));
    return;
  }
  e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CORE).then(x => x.put(req, c)); } return r; }).catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || caches.match('index.html'))));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => l.length ? l[0].focus() : self.clients.openWindow('./')));
});
