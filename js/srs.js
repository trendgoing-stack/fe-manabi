// 簡易ライトナー方式（問題・暗記カード共用）
import { addDays } from './date.js';

/** box 1〜5 の復習間隔（日） */
export const INTERVALS = [1, 3, 7, 14, 30];

/**
 * 回答結果から次の箱と復習日を決める。
 * 初回：正解なら box2、不正解なら box1。以降：正解で +1（最大5）、不正解で box1。
 * @param {{box:number}|undefined} prev
 * @param {boolean} ok
 * @param {string} today YYYY-MM-DD
 * @returns {{box:number, due:string}}
 */
export function schedule(prev, ok, today) {
  let box;
  if (!ok) box = 1;
  else if (!prev) box = 2;
  else box = Math.min(5, prev.box + 1);
  return { box, due: addDays(today, INTERVALS[box - 1]) };
}
