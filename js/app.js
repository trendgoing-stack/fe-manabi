// 起動処理
import * as storage from './storage.js';
import { loadData } from './loader.js';
import { route, start, parseHash } from './router.js';
import { app } from './state.js';
import { toast } from './ui/toast.js';
import { homeView } from './views/home.js';
import { drillView } from './views/drill.js';
import { runView } from './views/run.js';
import { resultView } from './views/result.js';
import { questionView } from './views/question.js';
import { reviewView } from './views/review.js';
import { settingsView } from './views/settings.js';
import { mockView, mockResultView } from './views/mock.js';
import { glossaryView, termView } from './views/glossary.js';
import { learnView } from './views/learn.js';
import { cardsView } from './views/cards.js';
import { helpView } from './views/help.js';

// ルート名 → 下部タブ
const TAB_OF = { home: 'home', drill: 'drill', run: 'drill', result: 'drill', mock: 'drill', 'mock-result': 'drill', review: 'review', learn: 'learn', terms: 'learn', term: 'learn', cards: 'learn', settings: 'settings', help: 'settings' };
// 出題中・模擬試験中はタブバーを隠し、Service Worker の更新もかけない
const BUSY_ROUTES = new Set(['run', 'mock']);

let waitingWorker = null;

function applySettings() {
  document.documentElement.dataset.font = storage.getSettings().fontSize;
}

function onRouteChange(name) {
  const tab = TAB_OF[name];
  for (const a of document.querySelectorAll('#tabbar a')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.body.classList.toggle('is-busy', BUSY_ROUTES.has(name));
  applySettings();
  showUpdateBanner();
}

// ---- Service Worker ----

function showUpdateBanner() {
  const banner = document.getElementById('update-banner');
  banner.hidden = !waitingWorker || BUSY_ROUTES.has(parseHash().name);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // 開発中（localhost）はキャッシュが邪魔になるので登録しない。?sw=1 を付けたときだけ有効にする
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (isLocal && !new URLSearchParams(location.search).has('sw')) {
    for (const reg of await navigator.serviceWorker.getRegistrations()) reg.unregister();
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const track = (worker) => {
      if (!worker) return;
      const check = () => {
        // 既に制御中のワーカーがいる状態で installed になったものが「更新」
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = worker;
          showUpdateBanner();
        }
      };
      worker.addEventListener('statechange', check);
      check();
    };
    track(reg.waiting);
    reg.addEventListener('updatefound', () => track(reg.installing));

    // 新しいワーカーは waiting で待たせ、バナーのタップでだけ切り替える
    document.getElementById('update-banner').addEventListener('click', () => {
      waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
    });
    // 初回インストール時の controllerchange では再読み込みしない
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !hadController) return;
      reloading = true;
      location.reload();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  } catch {
    // file:// や非対応環境では何もしない
  }
}

/** sw.js の VERSION をアプリのバージョンとして表示する */
async function readAppVersion() {
  try {
    const text = await (await fetch('./sw.js')).text();
    return text.match(/const VERSION = '([^']+)'/)?.[1] ?? '';
  } catch {
    return '';
  }
}

// ---- 起動 ----

async function main() {
  storage.setWriteErrorHandler(() => toast('保存できませんでした。端末の空き容量を確認し、設定からバックアップを取ってください', { error: true, ms: 6000 }));
  storage.init();
  applySettings();

  // ホーム画面起動のPWAはバックグラウンドで破棄されることがあるため、離脱時にも保存する
  const persist = () => {
    const s = storage.getSession();
    if (s) storage.saveSession(s);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persist();
  });
  window.addEventListener('pagehide', persist);

  [app.data, app.version] = await Promise.all([loadData(), readAppVersion()]);

  route('home', homeView);
  route('drill', drillView);
  route('run', runView);
  route('result', resultView);
  route('q', questionView);
  route('review', reviewView);
  route('settings', settingsView);
  route('mock', mockView);
  route('mock-result', mockResultView);
  route('learn', learnView);
  route('terms', glossaryView);
  route('term', termView);
  route('cards', cardsView);
  route('help', helpView);
  start(onRouteChange);

  registerServiceWorker();
}

main();
