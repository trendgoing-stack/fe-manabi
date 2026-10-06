// 用語の定義をポップアップで表示する
import { h } from '../dom.js';
import { openDialog } from './dialog.js';
import { app } from '../state.js';
import { navigate } from '../router.js';
import { richText } from '../render/text.js';
import { findTerms } from '../terms.js';
import { sectionsFor, sectionHref } from '../term-index.js';

/** @param {string} id 用語の id */
export function openTermDialog(id) {
  const t = app.data.termById.get(id);
  if (!t) return;
  const lessons = sectionsFor(t.id).slice(0, 3);
  openDialog((close) => [
    h('p', { class: 'muted small' }, `${t.category}・${t.reading}`),
    h('h2', null, t.term),
    t.aliases?.length ? h('p', { class: 'muted small' }, `別名：${t.aliases.join('、')}`) : null,
    h('p', null, richText(t.definition)),
    t.related?.length
      ? h(
          'div',
          { class: 'chips' },
          t.related
            .map((rid) => app.data.termById.get(rid))
            .filter(Boolean)
            .map((r) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'chip',
                  onClick: () => {
                    close();
                    openTermDialog(r.id);
                  },
                },
                r.term,
              ),
            ),
        )
      : null,
    lessons.length
      ? h(
          'div',
          null,
          h('p', { class: 'muted small' }, '解説テキストで読む'),
          h('div', { class: 'chips' }, lessons.map((l) => h('a', { class: 'chip', href: sectionHref(l), onClick: () => close() }, richText(l.section.title)))),
        )
      : null,
    h(
      'div',
      { class: 'btn-row' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn',
          onClick: () => {
            close();
            navigate(`term/${encodeURIComponent(t.id)}`);
          },
        },
        '用語集で見る',
      ),
      h('button', { type: 'button', class: 'btn primary', onClick: () => close() }, '閉じる'),
    ),
  ]);
}

/**
 * 文章中の用語をタップできるようにして返す。
 * @param {string} text
 * @param {string[]} termIds  対象にする用語（問題の terms[]）
 */
export function linkedText(text, termIds) {
  const terms = (termIds ?? []).map((id) => app.data.termById.get(id)).filter(Boolean);
  if (!terms.length) return richText(text);
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const f of findTerms(text, terms)) {
    if (f.start > last) frag.append(richText(text.slice(last, f.start)));
    frag.append(h('button', { type: 'button', class: 'term-link', onClick: () => openTermDialog(f.id) }, text.slice(f.start, f.end)));
    last = f.end;
  }
  if (last < text.length) frag.append(richText(text.slice(last)));
  return frag;
}
