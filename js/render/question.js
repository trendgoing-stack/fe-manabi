// 問題本文・選択肢・解説の描画
import { h } from '../dom.js';
import { richText } from './text.js';

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

/** 問題文（段落と表） @param {import('../types.js').Question} q */
export function renderStem(q) {
  return h(
    'div',
    { class: 'q-stem' },
    q.stem.map((p) => h('p', null, richText(p))),
    q.table ? renderTable(q.table) : null,
  );
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
          ? h('span', { class: 'choice-why' }, h('b', null, isAnswer ? '正解：' : '誤り：'), richText(c.why))
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
    h('p', null, richText(q.explanation)),
    q.asOf ? h('p', { class: 'muted small' }, `法令・制度・規格の基準時点：${q.asOf}`) : null,
  );
}

/** 分類などの補足行 */
export function renderMetaLine(q) {
  return h(
    'p',
    { class: 'muted small q-meta' },
    `${q.category}・難易度 ${'★'.repeat(q.difficulty)}${'☆'.repeat(3 - q.difficulty)}・${q.id}`,
    q.verification?.status === 'unverified' ? h('span', { class: 'badge warn' }, '未検証') : null,
  );
}
