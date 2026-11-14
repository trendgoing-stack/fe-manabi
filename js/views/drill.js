// 演習の条件設定
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { availableQuestions, startSession } from '../state.js';
import { filterQuestions, shuffled, groupSets, takeWhole, DEFAULT_CRITERIA } from '../selector.js';
import { FIELDS, CATEGORIES, B_CATEGORIES } from '../categories.js';
import { today } from '../date.js';
import { mockSection } from './mock.js';

const STATES = [
  { id: 'all', label: 'すべて' },
  { id: 'unanswered', label: '未回答のみ' },
  { id: 'recentWrong', label: '直近で誤答' },
  { id: 'everWrong', label: '一度でも誤答' },
  { id: 'lowRate', label: '正答率60%未満' },
  { id: 'marked', label: '見直す印' },
  { id: 'due', label: '復習期限' },
];
const COUNTS = [5, 10, 20, 0]; // 0 = 全件
const TAG_TOP = 12; // 論点は問題数の多い順にこの数だけ出し、残りは「ほか」で開く

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function drillView(root) {
  const saved = storage.getMeta().drill ?? {};
  /** @type {import('../selector.js').Criteria} */
  const c = { ...DEFAULT_CRITERIA, ...saved.criteria };
  let count = saved.count ?? 10;
  const pool = availableQuestions();
  const stats = storage.getStats();
  const marks = storage.getMarks();
  let showAllTags = false;

  const chip = (label, pressed, onClick) =>
    h('button', { type: 'button', class: 'chip' + (pressed ? ' is-on' : ''), 'aria-pressed': String(pressed), onClick }, label);

  const group = (title, ...children) => h('section', { class: 'card' }, h('h2', null, title), h('div', { class: 'chips' }, children));

  const draw = () => {
    // 分野を絞ったら、その分野に属さないカテゴリの選択は外す。科目Bは2分野だけ
    const isB = c.subject === 'B';
    if (isB) c.fields = [];
    const visibleCats = isB ? B_CATEGORIES.map((name) => ({ name })) : CATEGORIES.filter((cat) => !c.fields.length || c.fields.includes(cat.field));
    c.categories = c.categories.filter((name) => visibleCats.some((cat) => cat.name === name));
    // 論点（タグ）の候補：科目・分野・カテゴリ・難易度で絞った範囲にあるタグを、問題数の多い順に並べる
    const tagCount = new Map();
    for (const q of filterQuestions(pool, { ...c, tags: [], state: 'all' }, stats, today(), marks)) {
      for (const tag of q.tags ?? []) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
    c.tags = (c.tags ?? []).filter((tag) => tagCount.has(tag));
    const tagList = [...tagCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
    const shownTags = showAllTags ? tagList : tagList.filter(([tag], i) => i < TAG_TOP || c.tags.includes(tag));
    const matched = filterQuestions(pool, c, stats, today(), marks);
    const n = count === 0 ? matched.length : Math.min(count, matched.length);

    fill(
      root,
      h('h1', null, '演習'),
      mockSection(),
      h('a', { href: '#/find', class: 'btn big' }, '問題を探す（問題ID・キーワード）'),
      h('h2', { class: 'section-title' }, '一問一答'),
      group('科目', [['A', '科目A'], ['B', '科目B']].map(([id, label]) => chip(label, c.subject === id, () => update(() => { c.subject = id; c.categories = []; c.fields = []; c.tags = []; })))),
      isB ? null : group('分野', FIELDS.map((f) => chip(f.short, c.fields.includes(f.id), () => update(() => (c.fields = toggle(c.fields, f.id)))))),
      group(
        'カテゴリ（複数選択可）',
        visibleCats.map((cat) => chip(cat.name, c.categories.includes(cat.name), () => update(() => (c.categories = toggle(c.categories, cat.name))))),
      ),
      tagList.length
        ? group(
            '論点（タグ・複数選択可）',
            shownTags.map(([tag, k]) => chip(`${tag}（${k}）`, c.tags.includes(tag), () => update(() => (c.tags = toggle(c.tags, tag))))),
            tagList.length > TAG_TOP
              ? h('button', { type: 'button', class: 'chip chip-more', onClick: () => { showAllTags = !showAllTags; draw(); } }, showAllTags ? '少なく表示' : `ほか${tagList.length - shownTags.length}件を表示`)
              : null,
          )
        : null,
      group('難易度', [1, 2, 3].map((d) => chip('★'.repeat(d), c.difficulties.includes(d), () => update(() => (c.difficulties = toggle(c.difficulties, d)))))),
      group('状態', STATES.map((s) => chip(s.label, c.state === s.id, () => update(() => (c.state = s.id))))),
      group('出題数', COUNTS.map((v) => chip(v === 0 ? '全件' : `${v}問`, count === v, () => update(() => (count = v))))),
      h(
        'div',
        { class: 'sticky-action' },
        h('p', { class: 'muted small' }, `条件に合う問題：${matched.length}問（何も選ばない項目は「すべて」）`),
        h(
          'button',
          {
            type: 'button',
            class: 'btn primary big',
            disabled: n === 0,
            onClick: () => startSession('drill', isB ? '科目B' : '一問一答', takeWhole(groupSets(shuffled(matched)), n)),
          },
          n ? `${n}問で始める` : '条件に合う問題がありません',
        ),
      ),
    );
  };

  const update = (fn) => {
    fn();
    storage.saveMeta({ drill: { criteria: c, count } });
    draw();
  };

  draw();
}
