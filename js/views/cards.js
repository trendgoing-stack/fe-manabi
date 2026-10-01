// 暗記カード：表に用語、裏に定義。左右スワイプまたはボタンで「覚えた／まだ」を記録する。
// 間隔反復は問題と同じルール（srs.js）で、カード用に別管理する。
import { h, fill } from '../dom.js';
import * as storage from '../storage.js';
import { app } from '../state.js';
import { FIELDS, CATEGORIES } from '../categories.js';
import { richText } from '../render/text.js';
import { shuffled } from '../selector.js';
import { today } from '../date.js';
import { termsNav } from './glossary.js';

const NEW_PER_SESSION = 20;
const SWIPE = 80; // px

const fieldOf = (cat) => CATEGORIES.find((c) => c.name === cat)?.field;

/** 期限の来たカード（古い順）と、まだ見ていないカード */
function buildQueue(field) {
  const cards = storage.getCards();
  const t = today();
  const pool = app.data.glossary.filter((g) => !field || fieldOf(g.category) === field);
  const due = pool.filter((g) => cards[g.id] && cards[g.id].due <= t).sort((a, b) => cards[a.id].due.localeCompare(cards[b.id].due));
  const fresh = shuffled(pool.filter((g) => !cards[g.id])).slice(0, NEW_PER_SESSION);
  return { due, fresh, queue: [...due, ...fresh] };
}

export function cardsView(root) {
  let field = storage.getMeta().cardField ?? '';
  let state = null; // { queue, i, flipped, ok, ng }

  const drawStart = () => {
    const { due, fresh } = buildQueue(field);
    const chip = (id, label) =>
      h(
        'button',
        {
          type: 'button',
          class: 'chip' + (field === id ? ' is-on' : ''),
          'aria-pressed': String(field === id),
          onClick: () => {
            field = id;
            storage.saveMeta({ cardField: id });
            drawStart();
          },
        },
        label,
      );
    const total = due.length + fresh.length;
    fill(
      root,
      h('h1', null, '用語'),
      termsNav('cards'),
      h('section', { class: 'card' }, h('h2', null, '分野'), h('div', { class: 'chips' }, chip('', 'すべて'), FIELDS.map((f) => chip(f.id, f.short)))),
      h(
        'section',
        { class: 'card' },
        h('h2', null, '今日のカード'),
        h('p', null, `復習期限のカード ${due.length}枚、新しいカード ${fresh.length}枚`),
        h('p', { class: 'muted small' }, 'カードをタップすると裏返ります。右へスワイプで「覚えた」、左へスワイプで「まだ」。'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn primary big',
            disabled: total === 0,
            onClick: () => {
              state = { queue: buildQueue(field).queue, i: 0, flipped: false, ok: 0, ng: 0 };
              drawCard();
            },
          },
          total ? `${total}枚を始める` : '今日のカードはありません',
        ),
      ),
    );
  };

  const judge = (ok) => {
    const t = state.queue[state.i];
    storage.recordCard(t.id, ok);
    if (ok) state.ok++;
    else state.ng++;
    state.i++;
    state.flipped = false;
    if (state.i >= state.queue.length) drawDone();
    else drawCard();
  };

  const drawDone = () =>
    fill(
      root,
      h('h1', null, '用語'),
      termsNav('cards'),
      h('section', { class: 'card center' }, h('p', { class: 'score' }, `${state.ok} / ${state.ok + state.ng}`), h('p', null, '枚を「覚えた」にしました。')),
      h('div', { class: 'btn-col' }, h('button', { type: 'button', class: 'btn big', onClick: drawStart }, '戻る')),
    );

  const drawCard = () => {
    const t = state.queue[state.i];
    const card = h(
      'div',
      { class: 'flashcard' + (state.flipped ? ' is-flipped' : ''), role: 'button', tabindex: '0', 'aria-label': state.flipped ? `${t.term}の定義` : `${t.term}。タップで定義を表示` },
      state.flipped
        ? [h('p', { class: 'flash-term small' }, t.term), h('p', { class: 'flash-def' }, richText(t.definition))]
        : [h('p', { class: 'muted small' }, t.category), h('p', { class: 'flash-front' }, t.term), h('p', { class: 'muted small' }, 'タップで定義を表示')],
      h('span', { class: 'flash-hint flash-hint-ok', 'aria-hidden': 'true' }, '覚えた'),
      h('span', { class: 'flash-hint flash-hint-ng', 'aria-hidden': 'true' }, 'まだ'),
    );

    // Pointer Events でスワイプを判定する。縦スクロールはブラウザに任せる（touch-action: pan-y）
    let startX = null;
    let dx = 0;
    let moved = false;
    card.addEventListener('pointerdown', (e) => {
      startX = e.clientX;
      dx = 0;
      moved = false;
      card.setPointerCapture(e.pointerId);
      card.classList.add('is-dragging');
    });
    card.addEventListener('pointermove', (e) => {
      if (startX == null) return;
      dx = e.clientX - startX;
      if (Math.abs(dx) > 6) moved = true;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
      card.classList.toggle('show-ok', dx > SWIPE);
      card.classList.toggle('show-ng', dx < -SWIPE);
    });
    const end = () => {
      if (startX == null) return;
      startX = null;
      card.classList.remove('is-dragging');
      if (dx > SWIPE) return judge(true);
      if (dx < -SWIPE) return judge(false);
      card.style.transform = '';
      card.classList.remove('show-ok', 'show-ng');
      if (!moved) {
        state.flipped = !state.flipped;
        drawCard();
      }
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', () => {
      startX = null;
      card.classList.remove('is-dragging', 'show-ok', 'show-ng');
      card.style.transform = '';
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        state.flipped = !state.flipped;
        drawCard();
      }
    });

    fill(
      root,
      h(
        'header',
        { class: 'run-head' },
        h('button', { type: 'button', class: 'btn small', onClick: drawStart }, '終了'),
        h('span', { class: 'run-progress' }, `暗記カード　${state.i + 1} / ${state.queue.length}`),
        h('span'),
      ),
      h('div', { class: 'progress' }, h('span', { style: `width:${(state.i / state.queue.length) * 100}%` })),
      card,
      h(
        'div',
        { class: 'btn-row flash-buttons' },
        h('button', { type: 'button', class: 'btn grow', onClick: () => judge(false) }, '← まだ'),
        h('button', { type: 'button', class: 'btn primary grow', onClick: () => judge(true) }, '覚えた →'),
      ),
    );
  };

  drawStart();
}
