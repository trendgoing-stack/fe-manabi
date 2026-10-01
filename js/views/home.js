import { h, pct } from '../dom.js';
import * as storage from '../storage.js';
import * as analytics from '../analytics.js';
import { app, availableQuestions, startSession } from '../state.js';
import { isActive, summary } from '../session.js';
import { dueQuestions } from '../selector.js';
import { FIELDS } from '../categories.js';
import { today, diffDays } from '../date.js';
import { navigate, render } from '../router.js';
import { confirmDialog } from '../ui/dialog.js';
import { remainingMs } from '../mock.js';

/** 正答率の横棒 */
export function accuracyBar(label, { n, ok }) {
  const p = pct(ok, n);
  return h(
    'div',
    { class: 'bar-row' },
    h('span', { class: 'bar-label' }, label),
    h('span', { class: 'bar-track', role: 'img', 'aria-label': n ? `${label} 正答率${p}%` : `${label} 記録なし` },
      h('span', { class: 'bar-fill', style: `width:${p}%` })),
    h('span', { class: 'bar-value' }, n ? `${p}%` : '—'),
    h('span', { class: 'bar-count muted small' }, n ? `${ok}/${n}` : ''),
  );
}

export function homeView(root) {
  const settings = storage.getSettings();
  const t = today();
  const days = analytics.byDay();
  const todayCount = analytics.countOn(days, t);
  const streak = analytics.streak(days, t);
  const due = dueQuestions(availableQuestions(), storage.getStats(), t);
  const dueCount = Math.min(due.length, settings.reviewLimit);
  const session = storage.getSession();

  root.append(h('h1', null, '基本情報まなび帳'));

  if (app.data.failed.length) {
    root.append(
      h('div', { class: 'notice warn' }, `読み込めなかったデータがあります：${app.data.failed.join('、')}`),
    );
  }

  // 最終エクスポート（未実施なら利用開始）から14日を超えたらバックアップを勧める。閉じたら7日間は出さない
  const m = storage.getMeta();
  const DAY = 86400000;
  const hasRecords = Object.keys(storage.getStats()).length > 0;
  const overdue = Date.now() - (m.lastExportAt ?? m.firstAt ?? Date.now()) > 14 * DAY;
  const snoozed = m.backupDismissedAt && Date.now() - m.backupDismissedAt < 7 * DAY;
  if (hasRecords && overdue && !snoozed) {
    root.append(
      h(
        'div',
        { class: 'notice backup-notice' },
        h('span', null, m.lastExportAt ? '最後のバックアップから14日以上たっています。' : 'まだバックアップを取っていません。', h('a', { href: '#/settings' }, '設定でエクスポート')),
        h(
          'button',
          {
            type: 'button',
            class: 'btn small',
            'aria-label': 'バックアップの案内を閉じる',
            onClick: () => {
              storage.saveMeta({ backupDismissedAt: Date.now() });
              render();
            },
          },
          '閉じる',
        ),
      ),
    );
  }

  const mock = storage.getActiveMock();
  if (mock) {
    const left = Math.ceil(remainingMs(mock) / 60000);
    root.append(
      h(
        'section',
        { class: 'card accent' },
        h('h2', null, '実施中の模擬試験'),
        h('p', null, `回答済み ${mock.items.filter((x) => x.selected != null).length} / ${mock.items.length} 問・残り約${left}分${mock.runningSince == null ? '（中断中）' : ''}`),
        h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn primary', onClick: () => navigate('mock') }, '模擬試験に戻る')),
      ),
    );
  }

  if (isActive(session)) {
    const s = summary(session);
    root.append(
      h(
        'section',
        { class: 'card accent' },
        h('h2', null, '中断中の演習'),
        h('p', null, `${session.label}：${s.done} / ${s.total} 問まで回答済み`),
        h(
          'div',
          { class: 'btn-row' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn',
              onClick: async () => {
                if (await confirmDialog('中断中の演習を破棄しますか？（回答済みの記録は残ります）', { ok: '破棄', danger: true })) {
                  storage.clearSession();
                  render();
                }
              },
            },
            '破棄',
          ),
          h('button', { type: 'button', class: 'btn primary', onClick: () => navigate('run') }, '続きから再開'),
        ),
      ),
    );
  }

  const goalPct = Math.min(100, pct(todayCount, settings.dailyGoal));
  root.append(
    h(
      'section',
      { class: 'tiles' },
      h(
        'div',
        { class: 'tile' },
        h('span', { class: 'tile-label' }, '今日の復習'),
        h('span', { class: 'tile-value' }, dueCount, h('small', null, '件')),
        due.length > dueCount ? h('span', { class: 'muted small' }, `残り ${due.length - dueCount} 件は明日以降`) : null,
      ),
      h(
        'div',
        { class: 'tile' },
        h('span', { class: 'tile-label' }, '今日の学習'),
        h('span', { class: 'tile-value' }, todayCount, h('small', null, ` / ${settings.dailyGoal}問`)),
        h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: `width:${goalPct}%` })),
      ),
      h(
        'div',
        { class: 'tile' },
        h('span', { class: 'tile-label' }, '連続学習'),
        h('span', { class: 'tile-value' }, streak, h('small', null, '日')),
        streak > 0 && todayCount === 0 ? h('span', { class: 'muted small' }, '今日はまだ未学習') : null,
      ),
      settings.examDate && diffDays(t, settings.examDate) >= 0
        ? h(
            'div',
            { class: 'tile' },
            h('span', { class: 'tile-label' }, '試験日まで'),
            h('span', { class: 'tile-value' }, diffDays(t, settings.examDate), h('small', null, '日')),
            h('span', { class: 'muted small' }, settings.examDate),
          )
        : null,
    ),
  );

  root.append(
    h(
      'div',
      { class: 'btn-col' },
      dueCount
        ? h(
            'button',
            { type: 'button', class: 'btn primary big', onClick: () => startSession('review', '今日の復習', due.slice(0, dueCount)) },
            `今日の復習を始める（${dueCount}件）`,
          )
        : null,
      h('button', { type: 'button', class: 'btn big' + (dueCount ? '' : ' primary'), onClick: () => navigate('drill') }, '演習を始める'),
    ),
  );

  const fields = analytics.byField(days);
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, '分野別の正答率'),
      FIELDS.map((f) => accuracyBar(f.short, fields[f.id])),
      h('p', { class: 'muted small' }, '全期間の回答を集計しています。'),
    ),
  );
}
