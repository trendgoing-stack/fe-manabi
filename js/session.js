// 演習セッションの状態。回答のたびに保存し、アプリが破棄されても再開できるようにする。
import * as storage from './storage.js';
import { shuffled } from './selector.js';

/**
 * @param {import('./types.js').Session['mode']} mode
 * @param {string} label
 * @param {import('./types.js').Question[]} questions  出題順に並んだ問題
 * @param {import('./types.js').Settings} settings
 * @returns {import('./types.js').Session}
 */
export function createSession(mode, label, questions, settings) {
  const session = {
    mode,
    label,
    startedAt: Date.now(),
    pos: 0,
    finished: false,
    items: questions.map((q) => {
      const base = q.choices.map((_, i) => i);
      return {
        id: q.id,
        // 表示位置 → choices の index。正誤判定は常に choices の index で行う
        order: settings.shuffle && !q.fixedOrder ? shuffled(base) : base,
        selected: null,
        done: false,
        ok: null,
        unknown: false,
      };
    }),
  };
  storage.saveSession(session);
  return session;
}

/** 選択（確定前）。choiceIndex は choices の index */
export function select(session, choiceIndex) {
  const item = session.items[session.pos];
  if (item.done) return;
  item.selected = choiceIndex;
  storage.saveSession(session);
}

/**
 * 現在の問題を確定して記録する。
 * @param {import('./types.js').Session} session
 * @param {import('./types.js').Question} q
 * @param {boolean} [unknown]  「わからない」で確定
 */
export function commit(session, q, unknown = false) {
  const item = session.items[session.pos];
  if (item.done) return item;
  item.unknown = unknown;
  if (unknown) item.selected = null;
  item.ok = !unknown && item.selected === q.answer;
  item.done = true;
  storage.recordAnswer(q, item.ok, session.mode);
  storage.saveSession(session);
  return item;
}

/** 次の問題へ。最後なら finished にする */
export function advance(session) {
  if (session.pos < session.items.length - 1) session.pos++;
  else session.finished = true;
  storage.saveSession(session);
}

export const isActive = (s) => !!s && !s.finished && s.items.length > 0;

export function summary(session) {
  const done = session.items.filter((i) => i.done);
  const ok = done.filter((i) => i.ok).length;
  return { total: session.items.length, done: done.length, ok, wrong: done.filter((i) => !i.ok) };
}
