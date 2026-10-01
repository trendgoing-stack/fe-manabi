// 用語タブ：用語集（五十音順・検索）と用語の詳細
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { app } from '../state.js';
import { richText } from '../render/text.js';
import { navigate } from '../router.js';

const ROWS = [
  ['あ', 'あいうえおぁぃぅぇぉゔ'],
  ['か', 'かきくけこがぎぐげご'],
  ['さ', 'さしすせそざじずぜぞ'],
  ['た', 'たちつてとだぢづでどっ'],
  ['な', 'なにぬねの'],
  ['は', 'はひふへほばびぶべぼぱぴぷぺぽ'],
  ['ま', 'まみむめも'],
  ['や', 'やゆよゃゅょ'],
  ['ら', 'らりるれろ'],
  ['わ', 'わをんゎ'],
];
const rowOf = (reading) => ROWS.find(([, chars]) => chars.includes(reading[0]))?.[0] ?? 'わ';

const collator = new Intl.Collator('ja');
const sorted = () => app.data.glossary.slice().sort((a, b) => collator.compare(a.reading, b.reading));

/** 用語タブ共通の切り替え（用語集／暗記カード） */
export function termsNav(current) {
  const item = (id, label) =>
    h('a', { href: `#/${id}`, class: 'chip' + (current === id ? ' is-on' : ''), 'aria-current': current === id ? 'page' : null }, label);
  return h('nav', { class: 'chips subnav', 'aria-label': '用語' }, item('terms', '用語集'), item('cards', '暗記カード'));
}

export function glossaryView(root) {
  const all = sorted();
  const saved = storage.getMeta().glossaryQuery ?? '';
  const input = h('input', {
    type: 'search',
    class: 'input',
    placeholder: '用語・読み・定義で検索',
    value: saved,
    enterkeyhint: 'search',
    'aria-label': '用語を検索',
    onInput: () => draw(),
  });
  const list = h('div');

  const draw = () => {
    const query = input.value.trim().normalize('NFKC').toLowerCase();
    storage.saveMeta({ glossaryQuery: input.value });
    const match = (t) =>
      !query || [t.term, t.reading, ...(t.aliases ?? []), t.definition].some((s) => s.normalize('NFKC').toLowerCase().includes(query));
    const hits = all.filter(match);
    const groups = ROWS.map(([row]) => [row, hits.filter((t) => rowOf(t.reading) === row)]).filter(([, ts]) => ts.length);
    fill(
      list,
      h('p', { class: 'muted small' }, query ? `${hits.length}語が見つかりました` : `${all.length}語`),
      query
        ? null
        : h(
            'nav',
            { class: 'kana-index', 'aria-label': '五十音の見出し' },
            groups.map(([row]) => h('a', { href: `#kana-${row}`, onClick: (e) => { e.preventDefault(); document.getElementById(`kana-${row}`)?.scrollIntoView({ behavior: 'smooth' }); } }, row)),
          ),
      groups.map(([row, ts]) =>
        h(
          'section',
          { class: 'card' },
          h('h2', { id: `kana-${row}` }, `${row}行`),
          h(
            'ul',
            { class: 'link-list' },
            ts.map((t) =>
              h(
                'li',
                null,
                h('a', { href: `#/term/${encodeURIComponent(t.id)}` }, h('span', { class: 'term-name' }, t.term), h('span', { class: 'muted small' }, `${t.reading}・${t.category}`)),
              ),
            ),
          ),
        ),
      ),
      !hits.length ? h('p', { class: 'muted' }, '該当する用語がありません。') : null,
    );
  };

  root.append(h('h1', null, '用語'), termsNav('terms'), input, list);
  if (!all.length) list.append(h('p', { class: 'notice warn' }, '用語集を読み込めませんでした。'));
  else draw();
}

export function termView(root, [id]) {
  const t = app.data.termById.get(id);
  const back = h('button', { type: 'button', class: 'btn small', onClick: () => history.back() }, '戻る');
  if (!t) {
    root.append(h('header', { class: 'run-head' }, back), h('p', null, '用語が見つかりません。'));
    return;
  }
  const qs = app.data.questions.filter((q) => !q.retired && q.terms?.includes(t.id));
  const card = storage.getCards()[t.id];
  root.append(
    h('header', { class: 'run-head' }, back, h('span', { class: 'run-progress' }, '用語'), h('span')),
    h('p', { class: 'muted small' }, `${t.reading}・${t.category}`),
    h('h1', null, t.term),
    t.aliases?.length ? h('p', { class: 'muted small' }, `別名：${t.aliases.join('、')}`) : null,
    h('section', { class: 'card' }, h('p', { class: 'term-def' }, richText(t.definition))),
    card ? h('p', { class: 'muted small' }, `暗記カード：${card.correct}/${card.attempts}回「覚えた」・次の復習日 ${card.due}`) : null,
    t.related?.length
      ? h(
          'section',
          { class: 'card' },
          h('h2', null, '関連する用語'),
          h(
            'div',
            { class: 'chips' },
            t.related.map((rid) => app.data.termById.get(rid)).filter(Boolean).map((r) => h('a', { class: 'chip', href: `#/term/${encodeURIComponent(r.id)}` }, r.term)),
          ),
        )
      : null,
    qs.length
      ? h(
          'section',
          { class: 'card' },
          h('h2', null, `この用語が出てくる問題（${qs.length}問）`),
          h(
            'ul',
            { class: 'link-list' },
            qs.slice(0, 20).map((q) =>
              h('li', null, h('a', { href: `#/q/${encodeURIComponent(q.id)}` }, h('span', { class: 'link-title' }, q.stem[q.stem.length - 1]), h('span', { class: 'muted small' }, q.category))),
            ),
          ),
        )
      : null,
    h('div', { class: 'btn-col' }, h('button', { type: 'button', class: 'btn big', onClick: () => navigate('terms') }, '用語集の一覧へ')),
  );
}
