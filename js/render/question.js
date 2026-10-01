// 問題本文・選択肢・解説の描画
import { h } from '../dom.js';
import { richText } from './text.js';
import { renderFigure } from './figure.js';
import { linkedText } from '../ui/term.js';
import { renderCode, highlightLine } from './code.js';

export const LABELS = ['ア', 'イ', 'ウ', 'エ'];

/** @param {import('../types.js').TableData} table */
export function renderTable(table) {
  return h(
    'div',
    { class: 'scroll-x' },
    h(
      'table',
      { class: 'q-table' },
      h('thead', null, h('tr', null, table.header.map((c) => h('th', null, richText(c))))),
      h('tbody', null, table.rows.map((r) => h('tr', null, r.map((c) => h('td', null, richText(c)))))),
    ),
  );
}

/**
 * 問題文。set の設問なら、先に共通の題材（事例・表・図・コード）を表示する。
 * @param {import('../types.js').Question} q
 */
export function renderStem(q) {
  const setBlock = q.setId
    ? h(
        'section',
        { class: 'q-set' },
        q.setTitle ? h('h3', { class: 'q-set-title' }, q.setTitle) : null,
        (q.setStem ?? []).map((p) => h('p', null, richText(p))),
        q.setTable ? renderTable(q.setTable) : null,
        q.setFigure ? renderFigure(q.setFigure) : null,
        q.setCode ? renderCode(q.setCode) : null,
      )
    : null;
  return h(
    'div',
    { class: 'q-stem' + (q.subject === 'B' ? ' is-b' : '') },
    setBlock,
    q.stem.map((p) => h('p', null, richText(p))),
    q.table ? renderTable(q.table) : null,
    q.figure ? renderFigure(q.figure) : null,
    q.code ? renderCode(q.code) : null,
  );
}

/** 「n行目」をタップでコードの該当行を強調できるようにし、残りは用語リンク付きで描く */
function explainText(text, q) {
  if (!q.code && !q.setCode) return linkedText(text, q.terms);
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const m of text.matchAll(/(\d+)行目/g)) {
    if (m.index > last) frag.append(linkedText(text.slice(last, m.index), q.terms));
    const n = Number(m[1]);
    frag.append(h('button', { type: 'button', class: 'line-ref', onClick: () => highlightLine(n) }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(linkedText(text.slice(last), q.terms));
  return frag;
}

/**
 * 選択肢の一覧。
 * @param {import('../types.js').Question} q
 * @param {Object} o
 * @param {number[]} o.order              表示位置 → choices の index
 * @param {number|null} o.selected        選択中の choices の index
 * @param {boolean} o.revealed            答え合わせ後か
 * @param {(choiceIndex:number)=>void} [o.onSelect]
 */
export function renderChoices(q, { order, selected, revealed, onSelect }) {
  return h(
    'div',
    { class: 'choices', role: revealed ? 'list' : 'radiogroup' },
    order.map((ci, pos) => {
      const c = q.choices[ci];
      const isAnswer = ci === q.answer;
      const isSelected = ci === selected;
      const cls = ['choice'];
      if (isSelected) cls.push('is-selected');
      if (revealed) cls.push(isAnswer ? 'is-correct' : isSelected ? 'is-wrong' : 'is-other');
      const body = h(
        'span',
        { class: 'choice-body' },
        h('span', { class: 'choice-text' }, richText(c.text)),
        revealed
          ? h('span', { class: 'choice-why' }, h('b', null, isAnswer ? '正解：' : '誤り：'), explainText(c.why, q))
          : null,
      );
      const label = h('span', { class: 'choice-label', 'aria-hidden': 'true' }, LABELS[pos]);
      if (revealed) return h('div', { class: cls.join(' '), role: 'listitem' }, label, body);
      return h(
        'button',
        {
          type: 'button',
          class: cls.join(' '),
          role: 'radio',
          'aria-checked': String(isSelected),
          onClick: () => onSelect?.(ci),
        },
        label,
        body,
      );
    }),
  );
}

/** 解説ブロック @param {import('../types.js').Question} q */
export function renderExplanation(q) {
  return h(
    'section',
    { class: 'explain' },
    h('h3', null, '解説'),
    h('p', null, explainText(q.explanation, q)),
    q.terms?.length ? h('p', { class: 'muted small' }, '下線の用語をタップすると定義を表示します。') : null,
    q.code || q.setCode ? h('p', { class: 'muted small' }, '「n行目」をタップすると、プログラムの該当行を強調します。') : null,
    q.asOf ? h('p', { class: 'muted small' }, `法令・制度・規格の基準時点：${q.asOf}`) : null,
  );
}

/** 分類などの補足行 */
export function renderMetaLine(q) {
  return h(
    'p',
    { class: 'muted small q-meta' },
    `${q.subject === 'B' ? '科目B・' : ''}${q.category}・難易度 ${'★'.repeat(q.difficulty)}${'☆'.repeat(3 - q.difficulty)}・${q.id}`,
    q.verification?.status === 'unverified' ? h('span', { class: 'badge warn' }, '未検証') : null,
  );
}
