// 学習記録の集計。履歴（直近3000件）と、畳み込み済みの日別集計の両方を使う。
import * as storage from './storage.js';
import { CATEGORIES } from './categories.js';
import { localDate, addDays, parseDate, diffDays } from './date.js';

const fieldOfCategory = new Map(CATEGORIES.map((c) => [c.name, c.field]));

/**
 * 日付ごと・カテゴリごとの回答数と正解数
 * @returns {Map<string, Map<string, {n:number, ok:number}>>}
 */
export function byDay() {
  const out = new Map();
  const add = (date, category, n, ok) => {
    if (!out.has(date)) out.set(date, new Map());
    const day = out.get(date);
    const c = day.get(category) ?? { n: 0, ok: 0 };
    c.n += n;
    c.ok += ok;
    day.set(category, c);
  };
  for (const [date, cats] of Object.entries(storage.getDaily())) {
    for (const [category, v] of Object.entries(cats)) add(date, category, v.n, v.ok);
  }
  for (const e of storage.getHistory()) add(localDate(e.ts), e.category, 1, e.ok ? 1 : 0);
  return out;
}

const sumDay = (day) => {
  let n = 0;
  if (day) for (const v of day.values()) n += v.n;
  return n;
};

/** その日の回答数 */
export const countOn = (days, date) => sumDay(days.get(date));

/** 連続学習日数。今日未学習でも、昨日まで続いていれば維持して返す */
export function streak(days, today) {
  let d = countOn(days, today) > 0 ? today : addDays(today, -1);
  let n = 0;
  while (countOn(days, d) > 0) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/**
 * カテゴリ別の回答数と正解数
 * @param {string|null} since  この日付以降（null なら全期間）
 * @returns {Map<string, {n:number, ok:number}>}
 */
export function byCategory(days, since = null) {
  const out = new Map();
  for (const [date, cats] of days) {
    if (since && date < since) continue;
    for (const [category, v] of cats) {
      const c = out.get(category) ?? { n: 0, ok: 0 };
      c.n += v.n;
      c.ok += v.ok;
      out.set(category, c);
    }
  }
  return out;
}

/** 分野別の回答数と正解数 */
export function byField(days, since = null) {
  const out = { technology: { n: 0, ok: 0 }, management: { n: 0, ok: 0 }, strategy: { n: 0, ok: 0 } };
  for (const [category, v] of byCategory(days, since)) {
    const f = out[fieldOfCategory.get(category)];
    if (!f) continue;
    f.n += v.n;
    f.ok += v.ok;
  }
  return out;
}

/** その日を含む週の月曜日 */
export function weekStart(ymd) {
  const dow = (parseDate(ymd).getDay() + 6) % 7; // 月=0 … 日=6
  return addDays(ymd, -dow);
}

/**
 * 週別の回答数と正解数（古い順）。今週を含む直近 n 週。
 * @returns {{start:string, n:number, ok:number}[]}
 */
export function weekly(days, today, n = 12) {
  const first = addDays(weekStart(today), -7 * (n - 1));
  const out = Array.from({ length: n }, (_, i) => ({ start: addDays(first, 7 * i), n: 0, ok: 0 }));
  for (const [date, cats] of days) {
    if (date < first || date > today) continue;
    const w = out[Math.floor(diffDays(first, date) / 7)];
    for (const v of cats.values()) {
      w.n += v.n;
      w.ok += v.ok;
    }
  }
  return out;
}
