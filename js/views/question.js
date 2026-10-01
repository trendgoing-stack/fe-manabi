// #/q/<id>：1問を正解・解説付きで表示する（結果画面やフラグ一覧から開く）
import { h, pct, fill } from '../dom.js';
import * as storage from '../storage.js';
import { app } from '../state.js';
import { renderStem, renderChoices, renderExplanation, renderMetaLine } from '../render/question.js';
import { openFlagDialog } from '../ui/flag.js';
import { FLAG_KINDS } from '../categories.js';
import { renderTrace } from '../ui/trace.js';

export function questionView(root, [id]) {
  const q = app.data.byId.get(id);
  const back = h('button', { type: 'button', class: 'btn small', onClick: () => history.back() }, '戻る');
  if (!q) {
    root.append(h('header', { class: 'run-head' }, back), h('p', null, `問題 ${id ?? ''} が見つかりません。`));
    return;
  }

  const draw = () => {
    const flag = storage.getFlags()[q.id];
    const stat = storage.getStats()[q.id];
    fill(
      root,
      h(
        'header',
        { class: 'run-head' },
        back,
        h('span', { class: 'run-progress' }, '解説'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn small' + (flag ? ' is-flagged' : ''),
            onClick: async () => {
              if (await openFlagDialog(q.id)) draw();
            },
          },
          flag ? '報告済み' : '誤りを報告',
        ),
      ),
      renderMetaLine(q),
      q.retired ? h('div', { class: 'notice warn' }, 'この問題は出題を停止しています。') : null,
      flag
        ? h('div', { class: 'notice' }, `誤りフラグ：${FLAG_KINDS.find((k) => k.id === flag.kind)?.label ?? flag.kind}${flag.memo ? `（${flag.memo}）` : ''}`)
        : null,
      renderStem(q),
      renderChoices(q, { order: q.choices.map((_, i) => i), selected: null, revealed: true }),
      renderExplanation(q),
      renderTrace(q),
      stat
        ? h('p', { class: 'muted small' }, `これまでの成績：${stat.correct}/${stat.attempts}（${pct(stat.correct, stat.attempts)}%）・次の復習日 ${stat.due}`)
        : null,
    );
  };
  draw();
}
