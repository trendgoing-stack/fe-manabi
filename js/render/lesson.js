// 解説テキストのブロックを DOM にする。innerHTML は使わない。
import { h } from '../dom.js';
import { richText } from './text.js';
import { renderFigure } from './figure.js';
import { renderTable } from './question.js';
import { renderCode } from './code.js';
import { app } from '../state.js';
import { findTerms, namesOf } from '../terms.js';
import { openTermDialog } from '../ui/term.js';

const NOTE_LABEL = { point: 'ポイント', pitfall: '取り違えに注意', tip: 'コツ' };

/**
 * 段落の文章。用語集の用語を、その節で最初に出てきた箇所だけタップできるようにする。
 * @param {string} text
 * @param {Set<string>} seen  この節でリンク済みの用語 id
 */
/** 同じ表記の用語が複数あるときは、その章のカテゴリのものを優先する（例：プロセッサの CPI と EVM の CPI） */
function linkable(category) {
  const all = app.data.glossary;
  if (!category) return all;
  const own = new Set(all.filter((t) => t.category === category).flatMap(namesOf));
  return all.filter((t) => t.category === category || !namesOf(t).some((n) => own.has(n)));
}

let currentCategory = ''; // いま描いている節の章のカテゴリ（用語リンクの同名の優先に使う）

function linked(text, seen, category = currentCategory) {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const f of findTerms(text, linkable(category))) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    if (f.start > last) frag.append(richText(text.slice(last, f.start)));
    frag.append(h('button', { type: 'button', class: 'term-link', onClick: () => openTermDialog(f.id) }, text.slice(f.start, f.end)));
    last = f.end;
  }
  if (last < text.length) frag.append(richText(text.slice(last)));
  return frag;
}

/** @param {{type:string}} b @param {Set<string>} seen */
function renderBlock(b, seen) {
  switch (b.type) {
    case 'h':
      return h('h3', null, richText(b.text));
    case 'p':
      return h('p', null, linked(b.text, seen));
    case 'list':
      return h('ul', { class: 'lesson-steps' }, b.items.map((t) => h('li', null, linked(t, seen))));
    case 'steps':
      return h('div', null, b.title ? h('p', null, h('b', null, richText(b.title))) : null, h('ol', { class: 'lesson-steps' }, b.items.map((t) => h('li', null, linked(t, seen)))));
    case 'figure':
      return renderFigure(b.figure);
    case 'table':
      return h('div', null, b.title ? h('p', null, h('b', null, richText(b.title))) : null, renderTable(b.table));
    case 'code':
      return renderCode({ lines: b.lines }, b.title ?? 'プログラム');
    case 'note': {
      const kind = b.kind in NOTE_LABEL ? b.kind : 'point';
      return h('div', { class: `lesson-note is-${kind}` }, h('span', { class: 'note-title' }, b.title ?? NOTE_LABEL[kind]), h('span', null, linked(b.text, seen)));
    }
    case 'example':
      return h(
        'div',
        { class: 'lesson-example' },
        h('p', null, h('b', null, b.title ?? '例題'), '　', linked(b.text, seen)),
        b.figure ? renderFigure(b.figure) : null,
        h('details', null, h('summary', null, '答えと考え方を見る'), h('p', null, linked(b.answer, seen))),
      );
    default:
      return null;
  }
}

/** 節の本文（ブロックの並び） */
// 要約表示で残すブロック：小見出し、メモ（ポイント・取り違え・コツ）、図、表
const SUMMARY_TYPES = new Set(['h', 'note', 'figure', 'table']);

/** 要約表示のブロック。中身が続かない小見出しは落とす */
export function summaryBlocks(blocks) {
  const kept = blocks.filter((b) => SUMMARY_TYPES.has(b.type));
  return kept.filter((b, i) => b.type !== 'h' || (kept[i + 1] && kept[i + 1].type !== 'h'));
}

/** 節の本文（ブロックの並び）。summary が true なら要約表示 */
export function renderSectionBody(section, summary = false, category = '') {
  currentCategory = category;
  const seen = new Set();
  const blocks = summary ? summaryBlocks(section.blocks) : section.blocks;
  const d = summary ? section.digest : null;
  return h(
    'div',
    { class: 'lesson-body' },
    d
      ? h(
          'div',
          { class: 'lesson-digest' },
          h('p', null, linked(d.text, seen)),
          d.keys?.length ? h('ul', { class: 'lesson-keys' }, d.keys.map((k) => h('li', null, linked(k, seen)))) : null,
        )
      : null,
    blocks.map((b) => renderBlock(b, seen)),
  );
}
