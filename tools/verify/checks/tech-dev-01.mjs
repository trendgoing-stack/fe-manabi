import { pick } from '../lib/pick.mjs';

/** 複数条件網羅を満たす最少テストケース数を総当たりで求める */
function minCasesForMultipleConditionCoverage() {
  // 各条件の真偽を変えるのに十分な代表値
  const cases = [];
  for (const x of [5, 15, 25]) for (const y of [0, 1]) for (const z of [0, 1]) cases.push({ x, y, z });
  // 1件のテストケースが実行する、判定ごとの条件の真偽の組合せ
  const combos = (c) => [`1:${c.x > 10}:${c.y === 0}`, `2:${c.x > 20}:${c.z === 1}`];
  const required = 8; // 2判定 × 4通り
  for (let size = 1; size <= cases.length; size++) {
    for (let mask = 0; mask < 1 << cases.length; mask++) {
      const chosen = cases.filter((_, i) => mask & (1 << i));
      if (chosen.length !== size) continue;
      if (new Set(chosen.flatMap(combos)).size === required) return size;
    }
  }
  throw new Error('網羅できる組合せがない');
}

export const checks = {
  // 限界値分析：有効範囲 5〜40 の両端と、そのすぐ外側
  'a-tech-0062': (q) => {
    const lo = 5;
    const hi = 40;
    return pick(q, [lo - 1, lo, hi, hi + 1].join(', '));
  },
  'a-tech-0063': (q) => pick(q, minCasesForMultipleConditionCoverage()),
};
