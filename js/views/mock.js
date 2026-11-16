// 模擬試験（科目A）：出題画面と結果画面
import { h, fill, pct } from '../dom.js';
import * as storage from '../storage.js';
import { app, availableQuestions, startSession } from '../state.js';
import { mockChart } from '../render/chart.js';
import { remainingMs, pause, resume, pickQuestions, createMock, finishMock, GROUPS } from '../mock.js';
import { renderStem, renderChoices, renderExplanation, renderRelated, renderMetaLine, LABELS } from '../render/question.js';
import { CATEGORIES, B_CATEGORIES } from '../categories.js';
import { navigate } from '../router.js';
import { openDialog, confirmDialog } from '../ui/dialog.js';
import { accuracyBar } from './home.js';
import { localDate } from '../date.js';

const PASS_LINE = 60; // 素点での目安（%）
const TREND_MAX = 10;

const fmt = (ms) => {
  const sec = Math.ceil(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** 模擬試験を始める（演習タブから呼ぶ） */
export async function startMock(subject) {
  const spec = app.data.meta?.examSpec?.[subject];
  if (!spec) return;
  if (storage.getActiveMock()) return navigate('mock');
  const pool = availableQuestions().filter((q) => q.subject === subject);
  if (pool.length < spec.count) {
    if (!(await confirmDialog(`出題できる問題が${pool.length}問しかありません。${pool.length}問で始めますか？`, { ok: '始める' }))) return;
  }
  const ok = await confirmDialog(`科目${subject}の模擬試験（${Math.min(spec.count, pool.length)}問／${spec.minutes}分）を始めます。解説は終了後に表示します。`, { ok: '開始' });
  if (!ok) return;
  const qs = pickQuestions(subject, pool, spec.ratio, storage.listMocks().filter((m) => m.subject === subject));
  createMock(subject, qs, spec.minutes, storage.getSettings());
  navigate('mock');
}

/** 問題一覧（未回答・見直しの絞り込みと移動） */
function openList(m, jump, finish) {
  let filter = 'all';
  const body = h('div');
  const draw = (close) => {
    const items = m.items.map((it, i) => ({ it, i })).filter(({ it }) => (filter === 'blank' ? it.selected == null : filter === 'flag' ? it.flagged : true));
    const tab = (id, label) =>
      h('button', { type: 'button', class: 'chip' + (filter === id ? ' is-on' : ''), 'aria-pressed': String(filter === id), onClick: () => { filter = id; draw(close); } }, label);
    fill(
      body,
      h('div', { class: 'chips' }, tab('all', 'すべて'), tab('blank', `未回答 ${m.items.filter((x) => x.selected == null).length}`), tab('flag', `見直し ${m.items.filter((x) => x.flagged).length}`)),
      h(
        'div',
        { class: 'mock-grid' },
        items.length
          ? items.map(({ it, i }) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'mock-cell' + (it.selected != null ? ' is-answered' : '') + (it.flagged ? ' is-flagged' : '') + (i === m.pos ? ' is-current' : ''),
                  'aria-label': `問${i + 1}${it.selected != null ? ' 回答済み' : ' 未回答'}${it.flagged ? ' 見直し' : ''}`,
                  onClick: () => {
                    close();
                    jump(i);
                  },
                },
                String(i + 1),
              ),
            )
          : h('p', { class: 'muted' }, '該当する問題はありません。'),
      ),
    );
  };
  openDialog((close) => {
    draw(close);
    return [
      h('h2', null, '問題一覧'),
      body,
      h(
        'div',
        { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn danger', onClick: () => { close(); finish(); } }, '解答を終了'),
        h('button', { type: 'button', class: 'btn primary', onClick: () => close() }, '閉じる'),
      ),
    ];
  });
}

export function mockView(root) {
  const m = storage.getActiveMock();
  if (!m) return navigate('drill', { replace: true });
  let timer = 0;

  const finish = async (force = false) => {
    if (!force) {
      const blank = m.items.filter((x) => x.selected == null).length;
      const msg = blank ? `未回答が${blank}問あります。解答を終了して採点しますか？` : '解答を終了して採点しますか？';
      if (!(await confirmDialog(msg, { ok: '終了して採点' }))) return;
    }
    clearInterval(timer);
    finishMock(m, app.data.byId);
    navigate(`mock-result/${encodeURIComponent(m.id)}`, { replace: true });
  };

  const tick = () => {
    const el = document.getElementById('mock-timer');
    const left = remainingMs(m);
    if (el) {
      el.textContent = `残り ${fmt(left)}`;
      el.classList.toggle('is-low', left < 5 * 60 * 1000);
    }
    if (left <= 0) finish(true);
  };

  // 中断中なら、再開するまで時間を止めておく
  const drawPaused = () =>
    fill(
      root,
      h('h1', null, '模擬試験（中断中）'),
      h(
        'section',
        { class: 'card center' },
        h('p', { class: 'score' }, fmt(remainingMs(m))),
        h('p', { class: 'muted' }, `残り時間。回答済み ${m.items.filter((x) => x.selected != null).length} / ${m.items.length} 問`),
      ),
      h(
        'div',
        { class: 'btn-col' },
        h('button', { type: 'button', class: 'btn primary big', onClick: () => { resume(m); draw(); } }, '再開する'),
        h('button', { type: 'button', class: 'btn big', onClick: () => finish() }, '解答を終了して採点'),
        h('button', { type: 'button', class: 'btn big', onClick: () => navigate('drill') }, '戻る（中断のまま）'),
      ),
    );

  const draw = () => {
    if (m.runningSince == null) return drawPaused();
    const it = m.items[m.pos];
    const q = app.data.byId.get(it.id);
    const last = m.pos === m.items.length - 1;
    const jump = (i) => {
      m.pos = i;
      storage.saveActiveMock(m);
      draw();
      window.scrollTo(0, 0);
    };
    fill(
      root,
      h(
        'header',
        { class: 'run-head' },
        h('button', { type: 'button', class: 'btn small', onClick: () => { pause(m); drawPaused(); } }, '中断'),
        h('span', { class: 'mock-timer', id: 'mock-timer', role: 'timer' }, `残り ${fmt(remainingMs(m))}`),
        h('button', { type: 'button', class: 'btn small', onClick: () => openList(m, jump, finish) }, '一覧'),
      ),
      h('div', { class: 'progress' }, h('span', { style: `width:${(m.items.filter((x) => x.selected != null).length / m.items.length) * 100}%` })),
      h(
        'div',
        { class: 'mock-qhead' },
        h('strong', null, `問${m.pos + 1} / ${m.items.length}`),
        h(
          'button',
          {
            type: 'button',
            class: 'chip' + (it.flagged ? ' is-on' : ''),
            'aria-pressed': String(it.flagged),
            onClick: () => {
              it.flagged = !it.flagged;
              storage.saveActiveMock(m);
              draw();
            },
          },
          it.flagged ? '見直し ✓' : '見直し',
        ),
      ),
      q ? renderStem(q) : h('p', { class: 'notice warn' }, 'この問題はデータから削除されました。'),
      q
        ? renderChoices(q, {
            order: it.order,
            selected: it.selected,
            revealed: false,
            onSelect: (ci) => {
              it.selected = it.selected === ci ? null : ci;
              storage.saveActiveMock(m);
              draw();
            },
          })
        : null,
      h(
        'div',
        { class: 'sticky-action' },
        h(
          'div',
          { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn', disabled: m.pos === 0, onClick: () => jump(m.pos - 1) }, '前へ'),
          last
            ? h('button', { type: 'button', class: 'btn primary grow', onClick: () => finish() }, '解答を終了')
            : h('button', { type: 'button', class: 'btn primary grow', onClick: () => jump(m.pos + 1) }, '次へ'),
        ),
      ),
    );
    tick();
  };

  // バックグラウンドから戻ったときに残り時間を計算し直す
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
    else storage.saveActiveMock(m);
  };
  document.addEventListener('visibilitychange', onVisible);
  timer = setInterval(() => {
    if (m.runningSince != null) tick();
  }, 1000);
  draw();

  // 画面を離れたら中断扱いにして時間を止める（アプリの切替では止めない）
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    if (storage.getActiveMock()?.id === m.id) pause(m);
  };
}

/** 採点結果の1問分（正誤の印・問題・自分の解答・解説）。開いたときに中身を描く */
function resultItem(row, onOpen) {
  const { it, i, q, state } = row;
  const body = h('div', { class: 'mr-body' });
  const mark = { ok: '○', ng: '×', blank: '－' }[state];
  const word = { ok: '正解', ng: '不正解', blank: '未回答' }[state];
  const label = (ci) => (ci == null ? '未回答' : LABELS[it.order.indexOf(ci)] ?? '—');
  const el = h(
    'details',
    {
      class: `mr-item is-${state}`,
      id: `mr-q${i + 1}`,
      onToggle: () => {
        if (!el.open) return fill(body);
        onOpen(el);
        fill(
          body,
          h('p', { class: `mr-answer is-${state}` }, `あなたの解答：${label(it.selected)}　正解：${label(q.answer)}`),
          renderMetaLine(q),
          renderStem(q),
          renderChoices(q, { order: it.order, selected: it.selected, revealed: true }),
          renderExplanation(q),
          renderRelated(q),
          h('p', null, h('a', { href: `#/q/${encodeURIComponent(q.id)}` }, 'この問題のページを開く')),
        );
      },
    },
    h(
      'summary',
      { 'aria-label': `問${i + 1} ${word}${it.flagged ? ' 見直し' : ''} ${q.category}` },
      h('span', { class: 'mr-mark', 'aria-hidden': 'true' }, mark),
      h(
        'span',
        { class: 'mr-sum' },
        h('span', { class: 'link-title' }, `問${i + 1}　${q.stem[q.stem.length - 1]}`),
        h('span', { class: 'muted small' }, `${q.category}${state === 'blank' ? '・未回答' : ''}${it.flagged ? '・見直し' : ''}`),
      ),
    ),
    body,
  );
  return el;
}

export function mockResultView(root, [id]) {
  const m = storage.listMocks().find((x) => x.id === id);
  if (!m?.result) return navigate('drill', { replace: true });
  const { ok, total, byField } = m.result;
  const subject = m.subject ?? 'A';
  // 全問の正誤（データから消えた問題は除く）
  const rows = m.items
    .map((it, i) => ({ it, i, q: app.data.byId.get(it.id) }))
    .filter(({ q }) => q)
    .map((r) => ({ ...r, state: r.it.selected == null ? 'blank' : r.it.selected === r.q.answer ? 'ok' : 'ng' }));
  const count = (st) => rows.filter((r) => r.state === st).length;
  const wrong = rows.filter((r) => r.state !== 'ok');
  const retryable = wrong.filter(({ q }) => !q.retired).map(({ q }) => q);

  // カテゴリ別の集計（出題されたカテゴリだけ）
  const byCat = new Map();
  for (const r of rows) {
    const c = byCat.get(r.q.category) ?? { n: 0, ok: 0 };
    c.n++;
    if (r.state === 'ok') c.ok++;
    byCat.set(r.q.category, c);
  }
  const catOrder = [...CATEGORIES.map((c) => c.name), ...B_CATEGORIES];
  const cats = [...byCat].map(([name, v]) => ({ name, ...v })).sort((x, y) => catOrder.indexOf(x.name) - catOrder.indexOf(y.name));
  let catSort = storage.getMeta().mockCatSort === 'low' ? 'low' : 'syllabus';
  const catBox = h('div');
  const drawCats = () => {
    const list = catSort === 'low' ? [...cats].sort((x, y) => x.ok / x.n - y.ok / y.n || y.n - x.n) : cats;
    const tab = (key, text) =>
      h('button', { type: 'button', class: 'chip' + (catSort === key ? ' is-on' : ''), 'aria-pressed': String(catSort === key), onClick: () => { catSort = key; storage.saveMeta({ mockCatSort: key }); drawCats(); } }, text);
    fill(
      catBox,
      h('div', { class: 'chips' }, tab('syllabus', 'シラバス順'), tab('low', '正答率の低い順')),
      list.map((c) => {
        const bar = accuracyBar(c.name, c);
        if (pct(c.ok, c.n) < PASS_LINE) bar.classList.add('weak-top');
        return bar;
      }),
      h('p', { class: 'muted small' }, `色の付いた行は正答率が${PASS_LINE}%未満のカテゴリです。問題数が少ないカテゴリは、1問の正誤で大きく変わります。`),
    );
  };

  // 問題ごとの結果（番号の一覧・絞り込み・1問ずつ開く）
  let filter = wrong.length ? 'wrong' : 'all';
  const listBox = h('div', { class: 'mr-list' });
  const chipBox = h('div', { class: 'chips' });
  const match = (r) => (filter === 'wrong' ? r.state !== 'ok' : filter === 'ok' ? r.state === 'ok' : filter === 'flag' ? r.it.flagged : true);
  const onOpen = (el) => listBox.querySelectorAll('details[open]').forEach((d) => { if (d !== el) d.open = false; });
  const drawList = () => {
    const tab = (key, text) =>
      h('button', { type: 'button', class: 'chip' + (filter === key ? ' is-on' : ''), 'aria-pressed': String(filter === key), onClick: () => { filter = key; drawList(); } }, text);
    fill(
      chipBox,
      tab('all', `すべて ${rows.length}`),
      tab('wrong', `不正解・未回答 ${wrong.length}`),
      tab('ok', `正解 ${count('ok')}`),
      rows.some((r) => r.it.flagged) ? tab('flag', `見直し ${rows.filter((r) => r.it.flagged).length}`) : null,
    );
    const list = rows.filter(match);
    fill(listBox, list.length ? list.map((r) => resultItem(r, onOpen)) : h('p', { class: 'muted' }, '該当する問題はありません。'));
  };
  const openAt = (r) => {
    if (!match(r)) {
      filter = 'all';
      drawList();
    }
    const el = document.getElementById(`mr-q${r.i + 1}`);
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ block: 'start' });
  };

  const md = (ts) => {
    const d = localDate(ts);
    return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  };
  // 同じ科目の直近の回（古い順）。この回を強調する
  const trend = storage
    .listMocks()
    .filter((x) => x.result && (x.subject ?? 'A') === subject)
    .slice(0, TREND_MAX)
    .reverse()
    .map((x) => ({ label: md(x.startedAt), ok: x.result.ok, total: x.result.total, current: x.id === m.id }));

  drawCats();
  drawList();
  root.append(
    h('h1', null, '模擬試験の結果'),
    h(
      'section',
      { class: 'card center' },
      h('p', { class: 'muted' }, `科目${subject}・${localDate(m.startedAt)}`),
      h('p', { class: 'score' }, `${ok} / ${total}`, h('small', null, ' 問正解')),
      h('p', { class: 'score-sub' }, `正答率 ${pct(ok, total)}%`),
      h(
        'p',
        { class: 'mr-counts' },
        h('span', { class: 'is-ok' }, `○ 正解 ${count('ok')}`),
        h('span', { class: 'is-ng' }, `× 不正解 ${count('ng')}`),
        h('span', { class: 'is-blank' }, `－ 未回答 ${count('blank')}`),
      ),
      h('p', { class: 'muted small' }, `所要時間 ${fmt(m.elapsedMs)}`),
    ),
    h('div', { class: 'notice' }, 'この結果は正答数（素点）です。本試験はIRT（項目応答理論）による評価点で合否を判定するため、得点の換算方法が異なります。'),
    h('section', { class: 'card' }, h('h2', null, '分野別の正答率'), GROUPS[subject].map((g) => accuracyBar(g.label, byField[g.key] ?? { n: 0, ok: 0 }))),
    // 科目Bはカテゴリが分野と同じ2つなので、カテゴリ別は科目Aだけに出す
    subject === 'A' && cats.length ? h('section', { class: 'card' }, h('h2', null, 'カテゴリ別の正答率'), catBox) : null,
    h(
      'section',
      { class: 'card' },
      h('h2', null, '問題ごとの結果'),
      h('p', { class: 'muted small' }, '番号か問題をタップすると、自分の解答・正解・解説を表示します。'),
      h(
        'div',
        { class: 'mock-grid mr-grid' },
        rows.map((r) =>
          h(
            'button',
            {
              type: 'button',
              class: `mock-cell is-${r.state}` + (r.it.flagged ? ' is-flagged' : ''),
              'aria-label': `問${r.i + 1} ${{ ok: '正解', ng: '不正解', blank: '未回答' }[r.state]}${r.it.flagged ? ' 見直し' : ''}`,
              onClick: () => openAt(r),
            },
            String(r.i + 1),
          ),
        ),
      ),
      h(
        'p',
        { class: 'mr-legend muted small' },
        h('span', { class: 'mr-key is-ok' }), '正解　',
        h('span', { class: 'mr-key is-ng' }), '不正解　',
        h('span', { class: 'mr-key is-blank' }), '未回答　',
        '下線は見直しの印',
      ),
      chipBox,
      listBox,
    ),
    trend.length >= 2
      ? h(
          'section',
          { class: 'card' },
          h('h2', null, `これまでの推移（科目${subject}・直近${trend.length}回）`),
          h('div', { class: 'scroll-x' }, mockChart(trend, PASS_LINE)),
          h('p', { class: 'muted small' }, `濃い棒がこの回、点線が${PASS_LINE}%です。${PASS_LINE}%は素点での目安で、本試験の合否（評価点）とは一致しません。`),
        )
      : null,
    h(
      'div',
      { class: 'btn-col' },
      retryable.length
        ? h('button', { type: 'button', class: 'btn primary big', onClick: () => startSession('retry', '模擬試験の解き直し', retryable) }, `間違えた問題だけ解き直す（${retryable.length}問）`)
        : h('p', { class: 'center' }, '全問正解です。'),
      h('button', { type: 'button', class: 'btn big', onClick: () => navigate('drill') }, '演習へ戻る'),
    ),
  );
}

/** 演習タブに出す模擬試験の欄 */
export function mockSection() {
  const active = storage.getActiveMock();
  const past = storage.listMocks().slice(0, 5);
  const spec = (subject) => app.data.meta?.examSpec?.[subject];
  const has = (subject) => availableQuestions().some((q) => q.subject === subject);
  return h(
    'section',
    { class: 'card' },
    h('h2', null, '模擬試験'),
    h('p', { class: 'muted small' }, '配分は本試験に合わせ、直近の模擬試験で出していない問題を優先します。'),
    active
      ? h('button', { type: 'button', class: 'btn primary big', onClick: () => navigate('mock') }, `科目${active.subject}を再開する（残り ${fmt(remainingMs(active))}）`)
      : h(
          'div',
          { class: 'btn-col' },
          ['A', 'B'].filter(has).map((subject) =>
            h('button', { type: 'button', class: 'btn big', onClick: () => startMock(subject) }, `科目${subject}（${spec(subject)?.count ?? ''}問／${spec(subject)?.minutes ?? ''}分）を始める`),
          ),
        ),
    past.length
      ? h(
          'ul',
          { class: 'link-list' },
          past.map((p) =>
            h(
              'li',
              null,
              h(
                'a',
                { href: `#/mock-result/${encodeURIComponent(p.id)}` },
                h('span', null, `科目${p.subject ?? 'A'}　${localDate(p.startedAt)}　${p.result.ok} / ${p.result.total}問（${pct(p.result.ok, p.result.total)}%）`),
              ),
            ),
          ),
        )
      : null,
  );
}
