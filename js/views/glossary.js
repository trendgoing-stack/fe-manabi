// 学ぶタブの用語集：用語集（五十音順／カテゴリ別、分野の絞り込み、検索）と用語の詳細
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { app } from '../state.js';
import { richText } from '../render/text.js';
import { navigate } from '../router.js';
import { FIELDS, CATEGORIES, categoriesOf } from '../categories.js';

const fieldOf = (category) => CATEGORIES.find((c) => c.name === category)?.field;

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

/** 「学ぶ」タブ共通の切り替え（テキスト／用語集／暗記カード） */
export function learnNav(current) {
  const item = (id, label) =>
    h('a', { href: `#/${id}`, class: 'chip' + (current === id ? ' is-on' : ''), 'aria-current': current === id ? 'page' : null }, label);
  return h('nav', { class: 'chips subnav', 'aria-label': '学ぶ' }, item('learn', 'テキスト'), item('terms', '用語集'), item('cards', '暗記カード'));
}

/** 一覧の1行：用語名と、読み・分野・カテゴリ */
function termItem(t) {
  const field = FIELDS.find((f) => f.id === fieldOf(t.category));
  return h(
    'li',
    null,
    h(
      'a',
      { href: `#/term/${encodeURIComponent(t.id)}` },
      h('span', { class: 'term-name' }, t.term),
      h('span', { class: 'term-sub' }, h('span', { class: `field-tag field-${field?.id ?? 'other'}` }, field?.short ?? ''), h('span', { class: 'muted small' }, `${t.category}・${t.reading}`)),
    ),
  );
}

const jump = (id) => (e) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

export function glossaryView(root) {
  const all = sorted();
  const meta = storage.getMeta();
  let order = meta.glossaryOrder ?? 'kana'; // 'kana'（五十音順）または 'category'（カテゴリ別）
  let field = meta.glossaryField ?? ''; // '' はすべて
  const input = h('input', {
    type: 'search',
    class: 'input',
    placeholder: '用語・読み・定義で検索',
    value: meta.glossaryQuery ?? '',
    enterkeyhint: 'search',
    'aria-label': '用語を検索',
    onInput: () => draw(),
  });
  const controls = h('div');
  const list = h('div');

  const chip = (label, pressed, onClick) =>
    h('button', { type: 'button', class: 'chip' + (pressed ? ' is-on' : ''), 'aria-pressed': String(pressed), onClick }, label);

  const draw = () => {
    const query = input.value.trim().normalize('NFKC').toLowerCase();
    storage.saveMeta({ glossaryQuery: input.value, glossaryOrder: order, glossaryField: field });
    const match = (t) =>
      (!field || fieldOf(t.category) === field) &&
      (!query || [t.term, t.reading, t.category, ...(t.aliases ?? []), t.definition].some((x) => x.normalize('NFKC').toLowerCase().includes(query)));
    const hits = all.filter(match);

    fill(
      controls,
      h('div', { class: 'chips glossary-controls', role: 'group', 'aria-label': '並び順' }, chip('五十音順', order === 'kana', () => { order = 'kana'; draw(); }), chip('カテゴリ別', order === 'category', () => { order = 'category'; draw(); })),
      h(
        'div',
        { class: 'chips glossary-controls', role: 'group', 'aria-label': '分野' },
        chip('すべての分野', !field, () => { field = ''; draw(); }),
        FIELDS.map((f) => chip(f.short, field === f.id, () => { field = f.id; draw(); })),
      ),
    );

    const count = h('p', { class: 'muted small' }, query || field ? `${hits.length}語（全${all.length}語）` : `${all.length}語`);
    if (!hits.length) return fill(list, count, h('p', { class: 'muted' }, '該当する用語がありません。'));

    if (order === 'category') {
      // 分野ごとに、カテゴリ（シラバスの並び）の見出しを付けて並べる
      const fields = FIELDS.filter((f) => !field || f.id === field)
        .map((f) => [f, categoriesOf(f.id).map((c) => [c, hits.filter((t) => t.category === c.name)]).filter(([, ts]) => ts.length)])
        .filter(([, cats]) => cats.length);
      const catId = (c) => `cat-${CATEGORIES.indexOf(c)}`;
      return fill(
        list,
        count,
        h(
          'nav',
          { class: 'cat-index', 'aria-label': 'カテゴリの見出し' },
          fields.flatMap(([, cats]) => cats.map(([c, ts]) => h('a', { href: `#${catId(c)}`, onClick: jump(catId(c)) }, `${c.name}（${ts.length}）`))),
        ),
        fields.map(([f, cats]) => [
          h('h2', { class: `field-heading field-${f.id}` }, f.label),
          cats.map(([c, ts]) =>
            h('section', { class: 'card' }, h('h3', { id: catId(c), class: 'cat-heading' }, `${c.name}（${ts.length}語）`), h('ul', { class: 'link-list' }, ts.map(termItem))),
          ),
        ]),
      );
    }

    const groups = ROWS.map(([row]) => [row, hits.filter((t) => rowOf(t.reading) === row)]).filter(([, ts]) => ts.length);
    fill(
      list,
      count,
      h('nav', { class: 'kana-index', 'aria-label': '五十音の見出し' }, groups.map(([row]) => h('a', { href: `#kana-${row}`, onClick: jump(`kana-${row}`) }, row))),
      groups.map(([row, ts]) => h('section', { class: 'card' }, h('h2', { id: `kana-${row}` }, `${row}行`), h('ul', { class: 'link-list' }, ts.map(termItem)))),
    );
  };

  root.append(h('h1', null, '学ぶ'), learnNav('terms'), input, controls, list);
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
    h('p', { class: 'muted small' }, `${FIELDS.find((f) => f.id === fieldOf(t.category))?.label ?? ''}・${t.category}・${t.reading}`),
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
