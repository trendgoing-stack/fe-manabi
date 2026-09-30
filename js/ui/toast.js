import { h } from '../dom.js';

let timer = 0;

/** 画面下にメッセージを短時間表示する */
export function toast(message, { error = false, ms = 3200 } = {}) {
  const host = document.getElementById('toast');
  host.replaceChildren(h('div', { class: 'toast' + (error ? ' is-error' : ''), role: 'status' }, message));
  clearTimeout(timer);
  timer = setTimeout(() => host.replaceChildren(), ms);
}
