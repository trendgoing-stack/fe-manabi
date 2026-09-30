// 復習タブ：今日の復習、苦手分析、誤りフラグ一覧
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { app, availableQuestions, startSession } from '../state.js';
import { dueQuestions } from '../selector.js';
import { FLAG_KINDS } from '../categories.js';
import { today, addDays } from '../date.js';
import * as analytics from '../analytics.js';
import { accuracyBar } from './home.js';
import { weeklyChart } from '../render/chart.js';
import { navigate } from '../router.js';
import { openDialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';

/** フラグ済みの一覧を、修正依頼にそのまま貼れるJSONにする */
function flagsJson() {
  const flags = storage.getFlags();
  return JSON.stringify(
    {
      app: 'festudy',
      type: 'flags',
      dataVersion: app.data.meta?.dataVersion ?? null,
      exportedAt: new Date().toISOString(),
      flags: Object.entries(flags).map(([id, f]) => ({ id, kind: f.kind, memo: f.memo })),
    },
    null,
    2,
  );
}

function openFlagExport() {
  const text = flagsJson();
  const area = h('textarea', { class: 'input mono', rows: 10, readonly: true });
  area.value = text;
  const file = new File([text], 'festudy-flags.json', { type: 'application/json' });
  const canShare = !!navigator.canShare?.({ files: [file] });

  openDialog((close) => [
    h('h2', null, 'フラグ済みをエクスポート'),
    h('p', { class: 'muted small' }, 'Claude Code への修正依頼にそのまま貼り付けられます。'),
    area,
    h(
      'div',
      { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onClick: () => close() }, '閉じる'),
      canShare
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn',
              onClick: () => navigator.share({ files: [file] }).catch(() => {}),
            },
            '共有',
          )
        : null,
      h(
        'button',
        {
          type: 'button',
          class: 'btn primary',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast('コピーしました');
            } catch {
              area.focus();
              area.select();
              toast('自動コピーできません。選択された文字を手動でコピーしてください');
            }
          },
        },
        'コピー',
      ),
    ),
  ]);
}

const MIN_ANSWERS = 5;

/** 苦手分析：カテゴリ別の正答率（低い順）と週別の推移 */
function weaknessSection() {
  const box = h('section', { class: 'card' });
  const days = analytics.byDay();
  let period = storage.getMeta().weakPeriod ?? '30';

  const draw = () => {
    const since = period === '30' ? addDays(today(), -29) : null;
    const rows = [...analytics.byCategory(days, since)]
      .filter(([, v]) => v.n >= MIN_ANSWERS)
      .sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n || b[1].n - a[1].n);
    const tab = (id, label) =>
      h(
        'button',
        {
          type: 'button',
          class: 'chip' + (period === id ? ' is-on' : ''),
          'aria-pressed': String(period === id),
          onClick: () => {
            period = id;
            storage.saveMeta({ weakPeriod: id });
            draw();
          },
        },
        label,
      );

    fill(
      box,
      h('h2', null, '苦手分析'),
      h('div', { class: 'chips' }, tab('30', '直近30日'), tab('all', '全期間')),
      h('h3', null, 'カテゴリ別の正答率（低い順）'),
      rows.length
        ? rows.map(([name, v], i) => h('div', { class: i < 5 ? 'weak-top' : '' }, accuracyBar(name, v)))
        : h('p', { class: 'muted' }, `回答数が${MIN_ANSWERS}問以上のカテゴリがまだありません。`),
      rows.length
        ? [
            h('p', { class: 'muted small' }, `回答数${MIN_ANSWERS}問以上のカテゴリが対象です。正答率の低い上位5件を強調しています。`),
            h(
              'button',
              {
                type: 'button',
                class: 'btn big',
                onClick: () => {
                  // 苦手な上位（最大3カテゴリ）を選んだ状態で演習の条件設定を開く
                  const saved = storage.getMeta().drill ?? {};
                  storage.saveMeta({
                    drill: { ...saved, criteria: { ...saved.criteria, fields: [], difficulties: [], state: 'all', categories: rows.slice(0, 3).map(([name]) => name) } },
                  });
                  navigate('drill');
                },
              },
              '苦手なカテゴリを演習する',
            ),
          ]
        : null,
      h('h3', null, '週別の正答率（直近12週）'),
      h('div', { class: 'scroll-x' }, weeklyChart(analytics.weekly(days, today(), 12))),
    );
  };
  draw();
  return box;
}

export function reviewView(root) {
  const settings = storage.getSettings();
  const due = dueQuestions(availableQuestions(), storage.getStats(), today());
  const n = Math.min(due.length, settings.reviewLimit);
  const flags = Object.entries(storage.getFlags()).sort((a, b) => b[1].at - a[1].at);

  root.append(
    h('h1', null, '復習'),
    h(
      'section',
      { class: 'card' },
      h('h2', null, '今日の復習'),
      h('p', null, n ? `復習期限の来た問題が ${due.length} 件あります（1日の上限 ${settings.reviewLimit} 件）。` : '今日の復習はありません。'),
      n
        ? h('button', { type: 'button', class: 'btn primary big', onClick: () => startSession('review', '今日の復習', due.slice(0, n)) }, `${n}件を復習する`)
        : null,
    ),
    weaknessSection(),
    h(
      'section',
      { class: 'card' },
      h('h2', null, `誤りフラグ（${flags.length}件）`),
      flags.length
        ? [
            h(
              'ul',
              { class: 'link-list' },
              flags.map(([id, f]) => {
                const q = app.data.byId.get(id);
                return h(
                  'li',
                  null,
                  h(
                    'a',
                    { href: `#/q/${encodeURIComponent(id)}` },
                    h('span', { class: 'link-title' }, q ? q.stem[q.stem.length - 1] : '（データにない問題）'),
                    h('span', { class: 'muted small' }, `${id}・${FLAG_KINDS.find((k) => k.id === f.kind)?.label ?? f.kind}${f.memo ? `・${f.memo}` : ''}`),
                  ),
                );
              }),
            ),
            h('button', { type: 'button', class: 'btn big', onClick: openFlagExport }, 'フラグ済みをJSONでエクスポート'),
          ]
        : h('p', { class: 'muted' }, '問題画面の「誤りを報告」で付けたフラグがここに並びます。'),
    ),
  );
}
