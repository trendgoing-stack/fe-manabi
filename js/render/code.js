// 擬似言語コードの表示：等幅・行番号付き・インデント保持・横スクロール
import { h } from '../dom.js';

/**
 * @param {import('../types.js').CodeData} code
 * @param {string} [label]  読み上げ用の名前
 */
export function renderCode(code, label = 'プログラム') {
  return h(
    'div',
    { class: 'code-block scroll-x', role: 'region', 'aria-label': label, tabindex: '0' },
    h(
      'table',
      { class: 'code' },
      h(
        'tbody',
        null,
        code.lines.map((line, i) =>
          h('tr', { dataset: { line: String(i + 1) } }, h('td', { class: 'code-no', 'aria-hidden': 'true' }, String(i + 1)), h('td', { class: 'code-src' }, line || ' ')),
        ),
      ),
    ),
  );
}

/** 画面上のコードの n 行目を強調し、見える位置へ移動する */
export function highlightLine(n) {
  const rows = [...document.querySelectorAll(`.code tr[data-line="${n}"]`)];
  document.querySelectorAll('.code tr.is-hl').forEach((r) => r.classList.remove('is-hl'));
  if (!rows.length) return;
  rows.forEach((r) => r.classList.add('is-hl'));
  rows[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => rows.forEach((r) => r.classList.remove('is-hl')), 2600);
}
