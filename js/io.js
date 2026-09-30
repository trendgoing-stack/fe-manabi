// エクスポート／インポート。データは端末内で完結し、外部へは送信しない。
import * as storage from './storage.js';
import { app } from './state.js';
import { localDate } from './date.js';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** バックアップのJSON文字列を作る */
export function buildExport() {
  return JSON.stringify({
    app: 'festudy',
    type: 'backup',
    schemaVersion: storage.STORAGE_SCHEMA,
    exportedAt: new Date().toISOString(),
    dataVersion: app.data.meta?.dataVersion ?? null,
    data: storage.exportRaw(),
  });
}

export const exportFileName = () => `festudy-backup-${localDate()}.json`;

export const markExported = () => storage.saveMeta({ lastExportAt: Date.now() });

/**
 * Web Share API（files）で共有する。
 * @returns {Promise<'shared'|'cancelled'|'unavailable'>}
 */
export async function shareExport(text) {
  const file = new File([text], exportFileName(), { type: 'application/json' });
  if (!navigator.canShare?.({ files: [file] })) return 'unavailable';
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (e) {
    return e?.name === 'AbortError' ? 'cancelled' : 'unavailable';
  }
}

/** ダウンロードリンクで保存する */
export function downloadExport(text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * インポートするテキストを検証する。不正なら Error を投げる（何も変更しない）。
 * @param {string} text
 * @returns {ReturnType<typeof storage.exportRaw>}
 */
export function parseImport(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('JSONとして読み取れません');
  }
  if (!isObj(json) || json.app !== 'festudy' || json.type !== 'backup') throw new Error('このアプリのバックアップではありません');
  if (!Number.isInteger(json.schemaVersion) || json.schemaVersion < 1) throw new Error('スキーマバージョンがありません');
  if (json.schemaVersion > storage.STORAGE_SCHEMA) throw new Error('新しいバージョンのアプリで作られたバックアップです。アプリを更新してください');
  const d = json.data;
  if (!isObj(d) || !isObj(d.stats) || !Array.isArray(d.history) || !isObj(d.daily) || !isObj(d.flags)) throw new Error('データの形が正しくありません');

  for (const [id, s] of Object.entries(d.stats)) {
    const ok = isObj(s) && Number.isInteger(s.attempts) && Number.isInteger(s.correct) && s.correct <= s.attempts && typeof s.lastAt === 'number' && [1, 2, 3, 4, 5].includes(s.box) && DATE_RE.test(s.due);
    if (!ok) throw new Error(`成績データが不正です（${id}）`);
  }
  for (const e of d.history) {
    const ok = isObj(e) && typeof e.ts === 'number' && typeof e.id === 'string' && typeof e.ok === 'boolean' && typeof e.category === 'string';
    if (!ok) throw new Error('回答履歴が不正です');
  }
  for (const [date, cats] of Object.entries(d.daily)) {
    const ok = DATE_RE.test(date) && isObj(cats) && Object.values(cats).every((c) => isObj(c) && Number.isInteger(c.n) && Number.isInteger(c.ok));
    if (!ok) throw new Error('日別集計が不正です');
  }
  for (const f of Object.values(d.flags)) {
    if (!isObj(f) || typeof f.kind !== 'string') throw new Error('誤りフラグが不正です');
  }
  if (d.settings != null && !isObj(d.settings)) throw new Error('設定が不正です');
  return { settings: d.settings ?? null, stats: d.stats, history: d.history, daily: d.daily, flags: d.flags, foldedUntil: Number(d.foldedUntil) || 0 };
}

/**
 * 統合：問題ごとに lastAt が新しい側の成績を採用し、履歴は ts で重複を除いて結合する。
 * 設定はこの端末の値を保つ。
 */
export function mergeData(local, incoming) {
  const stats = { ...local.stats };
  for (const [id, s] of Object.entries(incoming.stats)) {
    if (!stats[id] || s.lastAt > stats[id].lastAt) stats[id] = s;
  }

  // 相手側で既に日別集計へ畳み込まれた時刻より古い履歴は、集計側に入っているので捨てる
  const seen = new Set();
  const history = [
    ...local.history.filter((e) => e.ts > incoming.foldedUntil),
    ...incoming.history.filter((e) => e.ts > local.foldedUntil),
  ].filter((e) => {
    const key = `${e.ts}:${e.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 日別集計は、同じバックアップを取り込み直しても二重に数えないよう、件数の多い側を採用する
  const daily = structuredClone(local.daily);
  for (const [date, cats] of Object.entries(incoming.daily)) {
    const day = (daily[date] ??= {});
    for (const [cat, v] of Object.entries(cats)) {
      if (!day[cat] || v.n > day[cat].n) day[cat] = v;
    }
  }

  const flags = { ...local.flags };
  for (const [id, f] of Object.entries(incoming.flags)) {
    if (!flags[id] || (f.at ?? 0) > (flags[id].at ?? 0)) flags[id] = f;
  }

  return { settings: null, stats, history, daily, flags, foldedUntil: Math.max(local.foldedUntil, incoming.foldedUntil) };
}

/**
 * @param {string} text
 * @param {'merge'|'replace'} mode
 * @returns {{questions:number, history:number}} 取り込み後の件数
 */
export function importData(text, mode) {
  const incoming = parseImport(text); // 不正ならここで例外。以降で初めて書き込む
  const next = mode === 'merge' ? mergeData(storage.exportRaw(), incoming) : incoming;
  if (mode === 'replace') storage.clearSession();
  if (!storage.importRaw(next)) throw new Error('保存できませんでした（容量不足の可能性があります）');
  return { questions: Object.keys(next.stats).length, history: next.history.length };
}
