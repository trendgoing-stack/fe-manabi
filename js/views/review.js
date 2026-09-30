// 復習タブ：今日の復習、誤りフラグ一覧（苦手分析はフェーズ2で追加）
import { h } from '../dom.js';
import * as storage from '../storage.js';
import { app, availableQuestions, startSession } from '../state.js';
import { dueQuestions } from '../selector.js';
import { FLAG_KINDS } from '../categories.js';
import { today } from '../date.js';
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
    h('section', { class: 'card' }, h('h2', null, '苦手分析'), h('p', { class: 'muted' }, '次の更新（フェーズ2）で追加します。')),
  );
}
