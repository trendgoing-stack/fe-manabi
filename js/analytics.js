// 学習記録の集計。履歴（直近3000件）と、畳み込み済みの日別集計の両方を使う。
import * as storage from './storage.js';
import { CATEGORIES } from './categories.js';
import { localDate, addDays } from './date.js';

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
