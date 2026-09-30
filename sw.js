// Service Worker：アプリ本体と data/ の全JSONをキャッシュファーストで返す。
// アプリのコードや問題データを更新したら、必ず VERSION を上げる（data/meta.json の dataVersion と同じ値にする）。
const VERSION = '2026.10.01-1';
const CACHE = `festudy-${VERSION}`;

const APP_SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/base.css',
  'css/components.css',
  'css/views.css',
  'js/app.js',
  'js/analytics.js',
  'js/categories.js',
  'js/date.js',
  'js/dom.js',
  'js/io.js',
  'js/loader.js',
  'js/router.js',
  'js/selector.js',
  'js/session.js',
  'js/srs.js',
  'js/state.js',
  'js/storage.js',
  'js/types.js',
  'js/render/chart.js',
  'js/render/question.js',
  'js/render/text.js',
  'js/ui/dialog.js',
  'js/ui/flag.js',
  'js/ui/toast.js',
  'js/views/drill.js',
  'js/views/home.js',
  'js/views/question.js',
  'js/views/result.js',
  'js/views/review.js',
  'js/views/run.js',
  'js/views/settings.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

// HTTPキャッシュを経由せず、必ずサーバーから取り直す
const fresh = (url) => new Request(url, { cache: 'reload' });

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const metaRes = await fetch(fresh('data/meta.json'));
      const meta = await metaRes.clone().json();
      await cache.put('data/meta.json', metaRes);
      await cache.addAll([...APP_SHELL, ...meta.files.map((f) => `data/${f}`)].map(fresh));
      // skipWaiting はしない。画面のバナーをタップしたときだけ切り替える
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('festudy-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (!url.href.startsWith(self.registration.scope)) return;
  // 開発用ツールと sw.js 自体はキャッシュしない
  const path = url.href.slice(self.registration.scope.length);
  if (path.startsWith('tools/') || path === 'sw.js') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      return fetch(req);
    })(),
  );
});
