// validate.html の画面側（開発用。アプリ本体からはリンクしない）
import { h, fill } from '../js/dom.js';
import { CATEGORIES, FIELDS } from '../js/categories.js';
import { renderStem, renderChoices, renderExplanation, renderMetaLine } from '../js/render/question.js';
import { validateAll } from './validate-core.js';

const root = document.getElementById('view');
// Service Worker のキャッシュを避けて、常に最新を読む
const get = async (url, type = 'json') => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  return res[type]();
};
const tryGet = (url, type) => get(url, type).catch(() => null);

const table = (headers, rows) =>
  h(
    'div',
    { class: 'scroll-x' },
    h(
      'table',
      { class: 'v' },
      h('thead', null, h('tr', null, headers.map((x) => h('th', null, x)))),
      h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => h('td', { class: i > 0 && typeof c === 'number' ? 'num' : '' }, c))))),
    ),
  );

async function main() {
  const meta = await tryGet('../data/meta.json');
  if (!meta) {
    fill(root, h('p', { class: 'ng' }, 'data/meta.json を読み込めません。'));
    return;
  }
  const files = await Promise.all(meta.files.map(async (file) => ({ file, json: await tryGet(`../data/${file}`) })));
  const swText = await tryGet('../sw.js', 'text');
  const glossary = await tryGet('../data/glossary.json');
  const r = validateAll(meta, files, swText, glossary);
  const get0 = (m, k) => m.get(k) ?? 0;

  const sampleHost = h('div');
  const drawSample = () => {
    const pool = r.questions.filter((q) => !q.retired);
    const picked = pool
      .map((q) => [Math.random(), q])
      .sort((a, b) => a[0] - b[0])
      .slice(0, 20)
      .map(([, q]) => q);
    sampleHost.replaceChildren(
      ...picked.map((q) =>
        h(
          'div',
          { class: 'sample' },
          renderMetaLine(q),
          renderStem(q),
          renderChoices(q, { order: [0, 1, 2, 3], selected: null, revealed: true }),
          renderExplanation(q),
          h('p', { class: 'muted small' }, `検証：${q.verification.status}（${q.verification.methods.join('、') || '—'}）${q.verification.note ? '／' + q.verification.note : ''}`),
        ),
      ),
    );
  };

  fill(
      root,
    h('h1', null, 'データ検証（開発用）'),
    h(
      'section',
      { class: 'card' },
      h('h2', null, '概要'),
      h(
        'dl',
        { class: 'kv' },
        h('dt', null, 'dataVersion'),
        h('dd', null, meta.dataVersion),
        h('dt', null, 'sw.js'),
        h('dd', { class: r.swVersion === meta.dataVersion ? 'ok' : 'ng' }, `${r.swVersion ?? '読めない'}（${r.swVersion === meta.dataVersion ? '一致' : '不一致'}）`),
        h('dt', null, 'シラバス'),
        h('dd', null, meta.syllabusVersion),
        h('dt', null, '問題数'),
        h('dd', null, `${r.questions.length}問（うち retired ${r.retired}）`),
        h('dt', null, 'エラー'),
        h('dd', { class: r.errors.length ? 'ng' : 'ok' }, r.errors.length ? `${r.errors.length}件` : 'なし'),
      ),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, `エラー（${r.errors.length}件）`),
      r.errors.length ? h('ul', { class: 'err-list' }, r.errors.map((e) => h('li', null, h('b', null, e.where), `：${e.msg}`))) : h('p', { class: 'ok' }, 'スキーマ違反・id重複・リンク切れ・解説の欠落はありません。'),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'ステータス別'),
      table(['ステータス', '件数'], ['unverified', 'ai-verified', 'user-verified', 'disputed'].map((s) => [s, get0(r.byStatus, s)])),
      h('p', { class: get0(r.byStatus, 'unverified') + get0(r.byStatus, 'disputed') ? 'ng' : 'ok' }, `unverified と disputed の合計：${get0(r.byStatus, 'unverified') + get0(r.byStatus, 'disputed')}件`),
      r.needsUserCheck.length ? h('p', null, `needsUserCheck：${r.needsUserCheck.join('、')}`) : h('p', { class: 'muted' }, 'needsUserCheck：なし'),
      r.disputed.length ? h('p', { class: 'ng' }, `disputed：${r.disputed.join('、')}`) : null,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, '分野・カテゴリ別（retired を除く）'),
      table(['分野', '件数'], FIELDS.map((f) => [f.label, get0(r.byField, f.id)])),
      table(['カテゴリ', '件数'], CATEGORIES.map((c) => [c.name, get0(r.byCategory, c.name)])),
      table(['シラバス中分類', '件数'], CATEGORIES.flatMap((c) => c.syllabusRefs).map((s) => [s, get0(r.bySyllabusRef, s)])),
      table(['難易度', '件数'], [1, 2, 3].map((d) => ['★'.repeat(d), get0(r.byDifficulty, d)])),
      table(['図', '件数'], [...r.byFigure].map(([k, v]) => [k, v])),
      h('p', null, `用語集 ${r.glossaryCount}語。用語リンクのある問題 ${r.linked}問。`),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, '偏りの統計'),
      table(['正解の位置（データ上）', '件数'], [0, 1, 2, 3].map((i) => [`choices[${i}]`, get0(r.byAnswer, i)])),
      h('p', null, `文章選択肢の問題 ${r.bias.n}問のうち、正解が最長：${r.bias.longest}問、正解が最短：${r.bias.shortest}問（偏りがなければ各25%前後）。正解の長さ÷他の平均：${r.bias.ratio.toFixed(2)}`),
      r.bias.outliers.length ? h('p', null, `正解が他の1.6倍を超える問題：${r.bias.outliers.join('、')}`) : null,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, '抜き取り確認'),
      h('p', { class: 'muted small' }, 'ランダムな20問を、正解と解説付きで表示します。'),
      h('button', { type: 'button', class: 'btn primary', onClick: drawSample }, 'ランダム20問を表示'),
      sampleHost,
    ),
  );
}

main();
