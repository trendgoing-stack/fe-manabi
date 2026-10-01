// localStorage の読み書きはここに集約する。画面側から localStorage を直接触らない。
// 学習記録は端末内にだけ保存し、外部へは送信しない。
import { schedule } from './srs.js';
import { localDate } from './date.js';
import { statKey } from './categories.js';

export const PREFIX = 'festudy:';
export const STORAGE_SCHEMA = 1;
export const HISTORY_MAX = 3000;

/** @type {import('./types.js').Settings} */
export const DEFAULT_SETTINGS = {
  fontSize: 'normal',
  shuffle: true,
  examDate: '',
  dailyGoal: 20,
  reviewLimit: 30,
  excludeFlagged: true,
  includeUnverified: false,
};

const cache = new Map();
let onWriteError = () => {};

/** 書き込み失敗（容量超過など）時に呼ぶ関数を登録する */
export function setWriteErrorHandler(fn) {
  onWriteError = fn;
}

function read(key, fallback) {
  if (cache.has(key)) return cache.get(key);
  let value = fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw != null) value = JSON.parse(raw);
  } catch {
    // 壊れた値や読み取り不可は初期値で続行する
  }
  cache.set(key, value);
  return value;
}

function write(key, value) {
  cache.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    onWriteError(e);
    return false;
  }
}

function remove(key) {
  cache.delete(key);
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // 無視
  }
}

/** 起動時に1回呼ぶ。スキーマバージョンの記録と、将来のマイグレーションの入口 */
export function init() {
  const v = read('schema', null);
  if (v == null) write('schema', STORAGE_SCHEMA);
  // v < STORAGE_SCHEMA のときはここで順に変換する（現在は v1 のみ）
  if (!getMeta().firstAt) saveMeta({ firstAt: Date.now() });
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

// ---- 設定 ----

/** @returns {import('./types.js').Settings} */
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read('settings', {}) });

/** @param {Partial<import('./types.js').Settings>} patch */
export const saveSettings = (patch) => write('settings', { ...getSettings(), ...patch });

// ---- 成績・履歴 ----

/** @returns {Object<string, import('./types.js').Stat>} */
export const getStats = () => read('stats', {});

/** @returns {import('./types.js').HistoryEntry[]} */
export const getHistory = () => read('history', []);

/** @returns {import('./types.js').Daily} 履歴から畳み込んだ古い分の日別集計 */
export const getDaily = () => read('daily', {});

/**
 * 1回の回答を記録する。全モード共通で、間隔反復の箱と復習日も更新する。
 * @param {import('./types.js').Question} q
 * @param {boolean} ok
 * @param {import('./types.js').HistoryEntry['mode']} mode
 */
export function recordAnswer(q, ok, mode) {
  const now = Date.now();
  const stats = getStats();
  const prev = stats[q.id];
  stats[q.id] = {
    attempts: (prev?.attempts ?? 0) + 1,
    correct: (prev?.correct ?? 0) + (ok ? 1 : 0),
    lastAt: now,
    lastOk: ok,
    ...schedule(prev, ok, localDate(now)),
  };
  write('stats', stats);

  const history = getHistory();
  history.push({ ts: now, id: q.id, ok, mode, field: q.field, category: q.category });
  if (history.length > HISTORY_MAX) foldHistory(history);
  write('history', history);
}

/** 上限を超えた古い履歴を日別集計へ畳み込み、履歴から削除する */
function foldHistory(history) {
  const daily = getDaily();
  let until = getMeta().foldedUntil ?? 0;
  for (const e of history.splice(0, history.length - HISTORY_MAX)) {
    const day = (daily[localDate(e.ts)] ??= {});
    const c = (day[statKey(e.id, e.category)] ??= { n: 0, ok: 0 });
    c.n++;
    if (e.ok) c.ok++;
    until = Math.max(until, e.ts);
  }
  write('daily', daily);
  // この時刻までの履歴は daily に入っている（インポート時の二重計上を防ぐ目印）
  saveMeta({ foldedUntil: until });
}

// ---- 誤りフラグ ----

/** @returns {Object<string, import('./types.js').Flag>} */
export const getFlags = () => read('flags', {});

export function setFlag(id, kind, memo) {
  const flags = getFlags();
  flags[id] = { kind, memo, at: Date.now() };
  return write('flags', flags);
}

export function removeFlag(id) {
  const flags = getFlags();
  delete flags[id];
  return write('flags', flags);
}

// ---- 中断中のセッション ----

/** @returns {import('./types.js').Session|null} */
export const getSession = () => read('session', null);
export const saveSession = (s) => write('session', s);
export const clearSession = () => remove('session');

// ---- 暗記カード（問題と同じ間隔反復ルールで別管理） ----

/** @returns {Object<string, {attempts:number, correct:number, lastAt:number, box:number, due:string}>} */
export const getCards = () => read('cards', {});

/** カードの「覚えた／まだ」を記録する */
export function recordCard(termId, ok) {
  const now = Date.now();
  const cards = getCards();
  const prev = cards[termId];
  cards[termId] = {
    attempts: (prev?.attempts ?? 0) + 1,
    correct: (prev?.correct ?? 0) + (ok ? 1 : 0),
    lastAt: now,
    ...schedule(prev, ok, localDate(now)),
  };
  return write('cards', cards);
}

// ---- 模擬試験 ----

export const MOCK_KEEP = 50;

/** 実施中の模擬試験 @returns {import('./types.js').MockExam|null} */
export const getActiveMock = () => read('mockActive', null);
export const saveActiveMock = (m) => write('mockActive', m);
export const clearActiveMock = () => remove('mockActive');

/** 終了した模擬試験の記録（新しい順） @returns {import('./types.js').MockExam[]} */
export function listMocks() {
  const ids = read('mockIndex', []);
  return ids.map((id) => read(`mock:${id}`, null)).filter(Boolean);
}

/** 模擬試験の記録を保存する。古いものから削除して MOCK_KEEP 件までにする */
export function saveMock(m) {
  const ids = [m.id, ...read('mockIndex', []).filter((x) => x !== m.id)];
  for (const old of ids.splice(MOCK_KEEP)) remove(`mock:${old}`);
  return write(`mock:${m.id}`, m) && write('mockIndex', ids);
}

// ---- その他 ----

export const getMeta = () => read('meta', {});
export const saveMeta = (patch) => write('meta', { ...getMeta(), ...patch });

// ---- バックアップ（エクスポート／インポート） ----

/** バックアップに含めるデータ。中断中のセッションは端末固有なので含めない */
export function exportRaw() {
  return {
    settings: getSettings(),
    stats: getStats(),
    history: getHistory(),
    daily: getDaily(),
    flags: getFlags(),
    foldedUntil: getMeta().foldedUntil ?? 0,
    cards: getCards(),
    mocks: listMocks(),
  };
}

/**
 * 検証済みのデータをまとめて書き込む。settings が無ければ現在の設定を保つ。
 * @returns {boolean} すべて書き込めたか
 */
export function importRaw({ settings, stats, history, daily, flags, foldedUntil, cards = {}, mocks = [] }) {
  history = history.slice().sort((a, b) => a.ts - b.ts);
  let ok = true;
  ok = write('cards', cards) && ok;
  for (const id of read('mockIndex', [])) remove(`mock:${id}`);
  write('mockIndex', []);
  for (const m of mocks.slice().sort((a, b) => a.startedAt - b.startedAt)) ok = saveMock(m) && ok;
  if (settings) ok = write('settings', { ...DEFAULT_SETTINGS, ...settings }) && ok;
  ok = write('stats', stats) && ok;
  ok = write('daily', daily) && ok;
  ok = write('flags', flags) && ok;
  ok = saveMeta({ foldedUntil }) && ok;
  if (history.length > HISTORY_MAX) foldHistory(history);
  ok = write('history', history) && ok;
  return ok;
}

/** このアプリのキーをすべて削除する */
export function clearAll() {
  cache.clear();
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // 無視
  }
}

/** 保存データのおおよそのサイズ（文字数） */
export function usage() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) total += k.length + (localStorage.getItem(k)?.length ?? 0);
    }
  } catch {
    // 無視
  }
  return total;
}
