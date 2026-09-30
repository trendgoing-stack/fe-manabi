// 設定・データ管理
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import * as io from '../io.js';
import { app, availableQuestions } from '../state.js';
import { confirmDialog, openDialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { localDate } from '../date.js';

const clamp = (v, min, max, fallback) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);

/** テキスト表示（コピー用）。共有もダウンロードもできないときの最後の手段 */
function openExportText(text) {
  const area = h('textarea', { class: 'input mono', rows: 10, readonly: true });
  area.value = text;
  return openDialog((close) => [
    h('h2', null, 'バックアップ（テキスト）'),
    h('p', { class: 'muted small' }, '全文をコピーして、メモなどに保存してください。インポートの「貼り付け」で戻せます。'),
    area,
    h(
      'div',
      { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onClick: () => close() }, '閉じる'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn primary',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(text);
              io.markExported();
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

/** エクスポート：Web Share API（files）→ ダウンロード → テキスト表示 の順に試す */
async function runExport(redraw) {
  const text = io.buildExport();
  const shared = await io.shareExport(text);
  if (shared === 'cancelled') return;
  if (shared === 'shared') {
    io.markExported();
    toast('エクスポートしました');
    return redraw();
  }
  if ('download' in HTMLAnchorElement.prototype) {
    io.downloadExport(text);
    io.markExported();
    toast('ダウンロードを開始しました。保存されない場合は「テキストで表示」を使ってください', { ms: 6000 });
    return redraw();
  }
  await openExportText(text);
  redraw();
}

function openImport(redraw) {
  let mode = 'merge';
  const area = h('textarea', { class: 'input mono', rows: 5, placeholder: 'バックアップのテキストを貼り付け' });
  const error = h('p', { class: 'notice warn', hidden: true, role: 'alert' });
  const file = h('input', {
    type: 'file',
    accept: '.json,application/json,text/plain',
    class: 'input',
    onChange: async (e) => {
      const f = e.target.files?.[0];
      if (f) area.value = await f.text();
    },
  });
  const radio = (id, label, note) =>
    h(
      'label',
      { class: 'radio-item' },
      h('input', { type: 'radio', name: 'import-mode', checked: mode === id, onChange: () => (mode = id) }),
      h('span', null, label, h('span', { class: 'muted small block' }, note)),
    );

  openDialog((close) => [
    h('h2', null, 'インポート'),
    h('p', { class: 'muted small' }, 'ファイルを選ぶか、テキストを貼り付けてください。'),
    file,
    area,
    h(
      'div',
      { class: 'radio-list' },
      radio('merge', '統合', '問題ごとに新しい方の成績を採用し、履歴を結合します。設定はこの端末のままです'),
      radio('replace', '置き換え', 'この端末の学習記録と設定を、バックアップの内容で上書きします'),
    ),
    error,
    h(
      'div',
      { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onClick: () => close() }, 'キャンセル'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn primary',
          onClick: async () => {
            const text = area.value.trim();
            try {
              if (!text) throw new Error('ファイルを選ぶか、テキストを貼り付けてください');
              io.parseImport(text); // 先に検証だけ行い、不正なら何も変更しない
              if (mode === 'replace' && !(await confirmDialog('この端末の学習記録と設定を上書きします。よろしいですか？', { ok: '置き換える', danger: true }))) return;
              const r = io.importData(text, mode);
              close();
              toast(`インポートしました（成績 ${r.questions}問、履歴 ${r.history}件）`);
              redraw();
            } catch (e) {
              error.textContent = `インポートできません：${e.message}（データは変更していません）`;
              error.hidden = false;
            }
          },
        },
        'インポート',
      ),
    ),
  ]);
}

export function settingsView(root) {
  const draw = () => {
    const s = storage.getSettings();
    const meta = app.data.meta;
    const last = storage.getMeta().lastExportAt;
    const save = (patch) => {
      storage.saveSettings(patch);
      document.documentElement.dataset.font = storage.getSettings().fontSize;
      draw();
    };

    const row = (label, note, control) =>
      h('label', { class: 'setting-row' }, h('span', null, label, note ? h('span', { class: 'muted small block' }, note) : null), control);

    const sw = (label, key, note) =>
      row(label, note, h('input', { type: 'checkbox', class: 'switch', role: 'switch', checked: s[key], onChange: (e) => save({ [key]: e.target.checked }) }));

    const num = (label, key, min, max, note) =>
      row(
        label,
        note ?? `${min}〜${max}`,
        h('input', {
          type: 'number',
          inputmode: 'numeric',
          min,
          max,
          value: String(s[key]),
          onChange: (e) => save({ [key]: clamp(e.target.valueAsNumber, min, max, s[key]) }),
        }),
      );

    fill(
      root,
      h('h1', null, '設定'),
      h(
        'section',
        { class: 'card' },
        h('h2', null, '表示'),
        row(
          '文字サイズ',
          null,
          h(
            'select',
            { onChange: (e) => save({ fontSize: e.target.value }) },
            h('option', { value: 'normal', selected: s.fontSize === 'normal' }, '標準'),
            h('option', { value: 'large', selected: s.fontSize === 'large' }, '大'),
          ),
        ),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', null, '学習'),
        row('受験予定日', 'ホームに残り日数を表示します', h('input', { type: 'date', value: s.examDate, onChange: (e) => save({ examDate: e.target.value }) })),
        num('1日の目標問題数', 'dailyGoal', 5, 200),
        num('1日の復習上限', 'reviewLimit', 10, 100),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', null, '出題'),
        sw('選択肢をシャッフルする', 'shuffle', '数値の昇順など、順序に意味がある問題は並べ替えません'),
        sw('誤りフラグ済みの問題を除外', 'excludeFlagged'),
        sw('未検証の問題を含める', 'includeUnverified', '通常は検証済みの問題だけを出題します'),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', null, 'データ管理'),
        h('p', { class: 'muted small' }, `最終エクスポート：${last ? localDate(last) : 'まだありません'}。Safari とホーム画面のアプリでは保存データが別なので、移すときもエクスポート／インポートを使います。`),
        h(
          'div',
          { class: 'btn-col' },
          h('button', { type: 'button', class: 'btn big primary', onClick: () => runExport(draw) }, 'エクスポート（バックアップ）'),
          h('button', { type: 'button', class: 'btn big', onClick: () => openExportText(io.buildExport()).then(draw) }, 'テキストで表示（コピー用）'),
          h('button', { type: 'button', class: 'btn big', onClick: () => openImport(draw) }, 'インポート'),
          h(
            'button',
            {
              type: 'button',
              class: 'btn big danger',
              onClick: async () => {
                if (!(await confirmDialog('学習記録・設定・誤りフラグをすべて削除します。元に戻せません。', { ok: 'すべて削除', danger: true }))) return;
                storage.clearAll();
                storage.init();
                toast('すべて削除しました');
                draw();
              },
            },
            '全データを削除',
          ),
        ),
      ),
      h(
        'section',
        { class: 'card' },
        h('h2', null, 'このアプリについて'),
        h(
          'dl',
          { class: 'kv' },
          h('dt', null, 'アプリ'),
          h('dd', null, app.version || '—'),
          h('dt', null, 'データ'),
          h('dd', null, meta?.dataVersion ?? '—'),
          h('dt', null, 'シラバス'),
          h('dd', null, meta?.syllabusVersion ?? '—'),
          h('dt', null, '収録問題'),
          h('dd', null, `${app.data.questions.length}問（出題対象 ${availableQuestions().length}問）`),
          h('dt', null, '保存データ'),
          h('dd', null, `約 ${Math.ceil(storage.usage() / 1024)} KB`),
        ),
        app.data.failed.length ? h('div', { class: 'notice warn' }, `読み込み失敗：${app.data.failed.join('、')}`) : null,
        h('p', { class: 'muted small' }, '問題・解説はすべてオリジナルで、本試験の過去問ではありません。学習記録はこの端末内にだけ保存され、外部には送信されません。'),
      ),
    );
  };
  draw();
}
