// ハッシュルーティング。#/drill、#/q/<id> など。ブラウザの「戻る」で前の画面に戻れる。

/**
 * @typedef {(root:HTMLElement, params:string[]) => (void|(() => void))} View
 */

/** @type {Map<string, View>} */
const routes = new Map();
let cleanup = null;
let onChange = () => {};

export function route(name, view) {
  routes.set(name, view);
}

export function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'home', params: parts.slice(1) };
}

export function navigate(path, { replace = false } = {}) {
  const hash = '#/' + path;
  if (location.hash === hash) render();
  else if (replace) location.replace(hash);
  else location.hash = hash;
}

export function render() {
  const { name, params } = parseHash();
  const view = routes.get(name) ?? routes.get('home');
  const root = document.getElementById('view');
  if (typeof cleanup === 'function') cleanup();
  root.replaceChildren();
  window.scrollTo(0, 0);
  cleanup = view(root, params) ?? null;
  onChange(routes.has(name) ? name : 'home');
}

export function start(changed) {
  onChange = changed;
  window.addEventListener('hashchange', render);
  render();
}
