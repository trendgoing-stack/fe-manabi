// 画面間で共有する状態と、セッション開始の共通処理
import * as storage from './storage.js';
import { isAvailable } from './selector.js';
import { createSession, isActive } from './session.js';
import { confirmDialog } from './ui/dialog.js';
import { navigate } from './router.js';

export const app = {
  /** @type {import('./loader.js').Loaded} */
  data: { meta: null, questions: [], byId: new Map(), failed: [] },
  version: '',
};

/** 現在の設定とフラグで出題できる問題 */
export function availableQuestions() {
  const settings = storage.getSettings();
  const flags = storage.getFlags();
  return app.data.questions.filter((q) => isAvailable(q, settings, flags));
}

/**
 * セッションを開始して演習画面へ移る。中断中のセッションがあれば確認する。
 * @param {import('./types.js').Session['mode']} mode
 * @param {string} label
 * @param {import('./types.js').Question[]} questions
 */
export async function startSession(mode, label, questions) {
  if (!questions.length) return false;
  if (isActive(storage.getSession())) {
    const ok = await confirmDialog('中断中の演習があります。破棄して新しく始めますか？', { ok: '破棄して開始', danger: true });
    if (!ok) return false;
  }
  createSession(mode, label, questions, storage.getSettings());
  navigate('run');
  return true;
}
