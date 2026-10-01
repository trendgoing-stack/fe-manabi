// 演習の条件設定
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { availableQuestions, startSession } from '../state.js';
import { filterQuestions, shuffled, DEFAULT_CRITERIA } from '../selector.js';
import { FIELDS, CATEGORIES } from '../categories.js';
import { today } from '../date.js';
import { mockSection } from './mock.js';

const STATES = [
  { id: 'all', label: 'すべて' },
  { id: 'unanswered', label: '未回答のみ' },
  { id: 'recentWrong', label: '直近で誤答' },
  { id: 'due', label: '復習期限' },
];
const COUNTS = [5, 10, 20, 0]; // 0 = 全件

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function drillView(root) {
  const saved = storage.getMeta().drill ?? {};
  /** @type {import('../selector.js').Criteria} */
  const c = { ...DEFAULT_CRITERIA, ...saved.criteria };
  let count = saved.count ?? 10;
  const pool = availableQuestions();
  const stats = storage.getStats();

  const chip = (label, pressed, onClick) =>
    h('button', { type: 'button', class: 'chip' + (pressed ? ' is-on' : ''), 'aria-pressed': String(pressed), onClick }, label);

  const group = (title, ...children) => h('section', { class: 'card' }, h('h2', null, title), h('div', { class: 'chips' }, children));

  const draw = () => {
    // 分野を絞ったら、その分野に属さないカテゴリの選択は外す
    const visibleCats = CATEGORIES.filter((cat) => !c.fields.length || c.fields.includes(cat.field));
    c.categories = c.categories.filter((name) => visibleCats.some((cat) => cat.name === name));
    const matched = filterQuestions(pool, c, stats, today());
    const n = count === 0 ? matched.length : Math.min(count, matched.length);

    fill(
      root,
      h('h1', null, '演習'),
      mockSection(),
      h('h2', { class: 'section-title' }, '一問一答'),
      group('分野', FIELDS.map((f) => chip(f.short, c.fields.includes(f.id), () => update(() => (c.fields = toggle(c.fields, f.id)))))),
      group(
        'カテゴリ（複数選択可）',
        visibleCats.map((cat) => chip(cat.name, c.categories.includes(cat.name), () => update(() => (c.categories = toggle(c.categories, cat.name))))),
      ),
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
            onClick: () => startSession('drill', '一問一答', shuffled(matched).slice(0, n)),
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
