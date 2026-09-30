// 設定（フェーズ1は出題に関わる項目のみ。残りはフェーズ2で追加）
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { app, availableQuestions } from '../state.js';

export function settingsView(root) {
  const draw = () => {
    const s = storage.getSettings();
    const meta = app.data.meta;
    const total = app.data.questions.length;

    const sw = (label, key, note) =>
      h(
        'label',
        { class: 'setting-row' },
        h('span', null, label, note ? h('span', { class: 'muted small block' }, note) : null),
        h('input', {
          type: 'checkbox',
          class: 'switch',
          role: 'switch',
          checked: s[key],
          onChange: (e) => {
            storage.saveSettings({ [key]: e.target.checked });
            draw();
          },
        }),
      );

    fill(
      root,
      h('h1', null, '設定'),
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
          h('dd', null, `${total}問（出題対象 ${availableQuestions().length}問）`),
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
