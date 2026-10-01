// トレース表：変数の値の推移を自分で書き込み、正解と照合する（任意で使うモード）
import { h, fill } from '../dom.js';

const norm = (s) => String(s ?? '').normalize('NFKC').replace(/\s+/g, '').replace(/[−‐–]/g, '-');

/**
 * @param {import('../types.js').Question} q   q.trace = { caption, vars, rows }
 * @returns {HTMLElement|null}
 */
export function renderTrace(q) {
  const t = q.trace;
  if (!t) return null;
  const box = h('section', { class: 'trace' });
  let open = false;
  let inputs = [];

  const draw = () => {
    if (!open) {
      fill(
        box,
        h('button', { type: 'button', class: 'btn big', onClick: () => { open = true; draw(); } }, 'トレース表で確かめる'),
      );
      return;
    }
    inputs = t.rows.map((row) =>
      row.map((_, j) =>
        h('input', {
          type: 'text',
          class: 'trace-input',
          inputmode: 'text',
          autocomplete: 'off',
          autocapitalize: 'off',
          spellcheck: false,
          'aria-label': t.vars[j],
        }),
      ),
    );
    const result = h('p', { class: 'trace-result', role: 'status' });
    fill(
      box,
      h('h3', null, 'トレース表'),
      h('p', { class: 'muted small' }, t.caption ?? '変数の値の推移を書き込んでください。'),
      h(
        'div',
        { class: 'scroll-x' },
        h(
          'table',
          { class: 'q-table trace-table' },
          h('thead', null, h('tr', null, h('th', null, '回'), t.vars.map((v) => h('th', null, v)))),
          h('tbody', null, inputs.map((row, i) => h('tr', null, h('td', { class: 'muted' }, String(i + 1)), row.map((inp) => h('td', null, inp))))),
        ),
      ),
      result,
      h(
        'div',
        { class: 'btn-row' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            onClick: () => {
              t.rows.forEach((row, i) =>
                row.forEach((v, j) => {
                  inputs[i][j].value = v;
                  inputs[i][j].classList.remove('is-ng');
                  inputs[i][j].classList.add('is-shown');
                }),
              );
              result.textContent = '正解を表示しました。';
            },
          },
          '正解を表示',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn primary',
            onClick: () => {
              let ok = 0;
              let total = 0;
              t.rows.forEach((row, i) =>
                row.forEach((v, j) => {
                  const inp = inputs[i][j];
                  total++;
                  const good = norm(inp.value) === norm(v);
                  if (good) ok++;
                  inp.classList.toggle('is-ok', good);
                  inp.classList.toggle('is-ng', !good);
                }),
              );
              result.textContent = ok === total ? `すべて正しいです（${total}マス）。` : `${total}マス中 ${ok}マスが正しいです。赤い枠のマスを見直してください。`;
            },
          },
          '照合',
        ),
      ),
    );
  };
  draw();
  return box;
}
