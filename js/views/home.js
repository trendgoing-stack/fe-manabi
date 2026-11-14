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

/** 進み具合の横棒（済んだ数／全体） */
function progressBar(label, done, total) {
  const p = pct(done, total);
  return h(
    'div',
    { class: 'bar-row' },
    h('span', { class: 'bar-label' }, label),
    h('span', { class: 'bar-track', role: 'img', 'aria-label': `${label} ${total}のうち${done}（${p}%）` }, h('span', { class: 'bar-fill', style: `width:${p}%` })),
    h('span', { class: 'bar-value' }, `${p}%`),
    h('span', { class: 'bar-count muted small' }, `${done}/${total}`),
  );
}

const MASTERED_BOX = 4; // 復習間隔が14日以上になった問題を「定着」とみなす

/** 全体の進み具合：問題・テキスト・暗記カードと、試験日までのペース */
function progressSection(pool, stats, t, examDate) {
  const answered = pool.filter((q) => stats[q.id]).length;
  const mastered = pool.filter((q) => (stats[q.id]?.box ?? 0) >= MASTERED_BOX).length;
  const sections = (app.data.texts ?? []).flatMap((c) => c.sections);
  const read = storage.getRead();
  const readCount = sections.filter((s) => read[s.id]).length;
  const cards = storage.getCards();
  const glossary = app.data.glossary ?? [];
  const seen = glossary.filter((g) => cards[g.id]).length;
  const cardsDue = glossary.filter((g) => cards[g.id] && cards[g.id].due <= t).length;

  const daysLeft = examDate ? diffDays(t, examDate) : -1;
  const per = (n) => Math.ceil(n / daysLeft);
  const pace = [];
  if (daysLeft > 0) {
    if (pool.length - answered > 0) pace.push(`未回答の問題 ${pool.length - answered}問：1日あたり約${per(pool.length - answered)}問`);
    if (sections.length - readCount > 0) pace.push(`未読の節 ${sections.length - readCount}節：1日あたり約${per(sections.length - readCount)}節`);
    if (glossary.length - seen > 0) pace.push(`まだ見ていない用語 ${glossary.length - seen}語：1日あたり約${per(glossary.length - seen)}語`);
  }

  return h(
    'section',
    { class: 'card' },
    h('h2', null, '全体の進み具合'),
    progressBar('問題（回答済み）', answered, pool.length),
    progressBar('問題（定着）', mastered, pool.length),
    sections.length ? progressBar('テキスト（読了）', readCount, sections.length) : null,
    glossary.length ? progressBar('暗記カード', seen, glossary.length) : null,
    h('p', { class: 'muted small' }, '「定着」は、正解が続いて復習の間隔が14日以上になった問題です。'),
    cardsDue ? h('p', null, h('a', { href: '#/cards' }, `復習期限の暗記カードが ${cardsDue}枚あります`)) : null,
    pace.length
      ? [h('h3', null, `試験日までに終えるペース（残り${daysLeft}日）`), h('ul', { class: 'pace-list' }, pace.map((x) => h('li', null, x)))]
      : !examDate
        ? h('p', { class: 'muted small' }, h('a', { href: '#/settings' }, '設定'), 'で受験予定日を入れると、1日あたりのペースを表示します。')
        : null,
  );
}

export function homeView(root) {
  const settings = storage.getSettings();
  const t = today();
  const days = analytics.byDay();
  const todayCount = analytics.countOn(days, t);
  const streak = analytics.streak(days, t);
  const pool = availableQuestions();
  const due = dueQuestions(pool, storage.getStats(), t);
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

  root.append(progressSection(pool, storage.getStats(), t, settings.examDate));

  const fields = analytics.byField(days);
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, '分野別の正答率'),
      FIELDS.map((f) => accuracyBar(f.short, fields[f.id])),
      fields.B.n ? accuracyBar('科目B', fields.B) : null,
      h('p', { class: 'muted small' }, '全期間の回答を集計しています。'),
    ),
  );
}
