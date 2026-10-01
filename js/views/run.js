// 演習の出題画面。流れ：表示 → 選択 → 答え合わせ → 正誤と解説 → 次へ
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { app } from '../state.js';
import { isActive, select, commit, advance } from '../session.js';
import { renderStem, renderChoices, renderExplanation, renderMetaLine, LABELS } from '../render/question.js';
import { navigate } from '../router.js';
import { openFlagDialog } from '../ui/flag.js';
import { renderTrace } from '../ui/trace.js';

export function runView(root) {
  const session = storage.getSession();
  if (!session) return navigate('drill', { replace: true });
  if (!isActive(session)) return navigate('result', { replace: true });

  // データ更新で問題が無くなった場合は、その問題を飛ばす
  const skipMissing = () => {
    while (isActive(session) && !app.data.byId.get(session.items[session.pos].id)) {
      session.items.splice(session.pos, 1);
      if (session.pos >= session.items.length) {
        session.pos = Math.max(0, session.items.length - 1);
        session.finished = true;
      }
    }
    storage.saveSession(session);
  };

  const draw = (scrollToResult = false) => {
    skipMissing();
    if (!isActive(session)) return navigate('result', { replace: true });

    const item = session.items[session.pos];
    const q = app.data.byId.get(item.id);
    const last = session.pos === session.items.length - 1;
    const flagged = !!storage.getFlags()[q.id];

    const resultBanner = item.done
      ? h(
          'div',
          { class: 'result-banner ' + (item.ok ? 'is-ok' : 'is-ng'), id: 'result-banner', role: 'status' },
          h('strong', null, item.ok ? '正解' : item.unknown ? 'わからない（不正解として記録）' : '不正解'),
          h('span', null, `正解は ${LABELS[item.order.indexOf(q.answer)]}`),
        )
      : null;

    fill(
      root,
      h(
        'header',
        { class: 'run-head' },
        h('button', { type: 'button', class: 'btn small', onClick: () => navigate('home') }, '中断'),
        h('span', { class: 'run-progress' }, `${session.label}　${session.pos + 1} / ${session.items.length}`),
        h(
          'button',
          {
            type: 'button',
            class: 'btn small' + (flagged ? ' is-flagged' : ''),
            onClick: async () => {
              if (await openFlagDialog(q.id)) draw();
            },
          },
          flagged ? '報告済み' : '誤りを報告',
        ),
      ),
      h('div', { class: 'progress' }, h('span', { style: `width:${((session.pos + (item.done ? 1 : 0)) / session.items.length) * 100}%` })),
      renderMetaLine(q),
      renderStem(q),
      resultBanner,
      renderChoices(q, {
        order: item.order,
        selected: item.selected,
        revealed: item.done,
        onSelect: (ci) => {
          select(session, ci);
          draw();
        },
      }),
      item.done ? renderExplanation(q) : null,
      renderTrace(q),
      h(
        'div',
        { class: 'sticky-action' },
        item.done
          ? h(
              'button',
              {
                type: 'button',
                class: 'btn primary big',
                onClick: () => {
                  advance(session);
                  if (session.finished) navigate('result', { replace: true });
                  else {
                    draw();
                    window.scrollTo(0, 0);
                  }
                },
              },
              last ? '結果を見る' : '次へ',
            )
          : h(
              'div',
              { class: 'btn-row' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'btn',
                  onClick: () => {
                    commit(session, q, true);
                    draw(true);
                  },
                },
                'わからない',
              ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'btn primary grow',
                  disabled: item.selected == null,
                  onClick: () => {
                    commit(session, q);
                    draw(true);
                  },
                },
                '答え合わせ',
              ),
            ),
      ),
    );
    if (scrollToResult) document.getElementById('result-banner')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  draw();
}
