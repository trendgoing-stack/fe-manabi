// セッションの結果
import { h, pct } from '../dom.js';
import * as storage from '../storage.js';
import { app, startSession } from '../state.js';
import { isActive, summary } from '../session.js';
import { navigate } from '../router.js';

export function resultView(root) {
  const session = storage.getSession();
  if (!session) return navigate('drill', { replace: true });
  if (isActive(session)) return navigate('run', { replace: true });

  const s = summary(session);
  const wrong = s.wrong.map((i) => ({ item: i, q: app.data.byId.get(i.id) })).filter((w) => w.q);

  root.append(
    h('h1', null, '結果'),
    h(
      'section',
      { class: 'card center' },
      h('p', { class: 'muted' }, session.label),
      h('p', { class: 'score' }, `${s.ok} / ${s.done}`, h('small', null, ' 問正解')),
      h('p', { class: 'score-sub' }, `正答率 ${pct(s.ok, s.done)}%`),
    ),
  );

  if (wrong.length) {
    root.append(
      h(
        'section',
        { class: 'card' },
        h('h2', null, `間違えた問題（${wrong.length}問）`),
        h(
          'ul',
          { class: 'link-list' },
          wrong.map(({ item, q }) =>
            h(
              'li',
              null,
              h(
                'a',
                { href: `#/q/${encodeURIComponent(q.id)}` },
                h('span', { class: 'link-title' }, q.stem[q.stem.length - 1]),
                h('span', { class: 'muted small' }, `${q.category}${item.unknown ? '・わからない' : ''}`),
              ),
            ),
          ),
        ),
      ),
    );
  } else {
    root.append(h('p', { class: 'center' }, '全問正解です。'));
  }

  root.append(
    h(
      'div',
      { class: 'btn-col' },
      wrong.length
        ? h(
            'button',
            { type: 'button', class: 'btn primary big', onClick: () => startSession('retry', '間違えた問題', wrong.map((w) => w.q)) },
            '間違えた問題だけもう一度',
          )
        : null,
      h('button', { type: 'button', class: 'btn big', onClick: () => navigate('drill') }, '条件を変えて演習'),
      h('button', { type: 'button', class: 'btn big', onClick: () => navigate('home') }, 'ホームへ'),
    ),
  );
}
