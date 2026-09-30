import { pick } from '../lib/pick.mjs';

/** 問題の table を、見出しをキーにしたオブジェクトの配列にする */
const rowsOf = (q) =>
  q.table.rows.map((r) => Object.fromEntries(q.table.header.map((h, i) => [h, r[i]])));

/** key でグループ化して、値の配列の Map を返す */
const groupBy = (rows, key, value) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r[key])) m.set(r[key], []);
    m.get(r[key]).push(Number(r[value]));
  }
  return m;
};

const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => sum(a) / a.length;

export const checks = {
  // GROUP BY 倉庫 HAVING SUM(数量) >= 100 の結果行数
  'a-tech-0040': (q) => {
    const groups = groupBy(rowsOf(q), '倉庫', '数量');
    return pick(q, [...groups.values()].filter((v) => sum(v) >= 100).length);
  },

  // 同じ分類の平均単価より単価が高い商品の件数（相関副問合せ）
  'a-tech-0041': (q) => {
    const rows = rowsOf(q);
    const groups = groupBy(rows, '分類', '単価');
    return pick(q, rows.filter((r) => Number(r['単価']) > avg(groups.get(r['分類']))).length);
  },

  // IPアドレスとサブネットマスクの論理積
  'a-tech-0046': (q) => {
    const ip = [10, 84, 157, 200];
    const mask = [255, 255, 240, 0];
    return pick(q, ip.map((o, i) => o & mask[i]).join('.'));
  },

  // /24 を同じ大きさに分割し、各サブネットで45台を収容できる最大の分割数
  'a-tech-0047': (q) => {
    const hosts = 45;
    let best = 0;
    for (let prefix = 24; prefix <= 30; prefix++) {
      const usable = 2 ** (32 - prefix) - 2;
      if (usable >= hosts) best = Math.max(best, 2 ** (prefix - 24));
    }
    return pick(q, best);
  },

  // 転送時間 = ビット数 ÷ (回線速度 × 伝送効率)
  'a-tech-0048': (q) => {
    const bits = 450e6 * 8;
    const effective = 40e6 * 0.6;
    return pick(q, bits / effective);
  },

  // 共通鍵 n(n-1)/2 個と、公開鍵 2n 個の差
  'a-tech-0052': (q) => {
    const n = 12;
    return pick(q, (n * (n - 1)) / 2 - 2 * n);
  },
};
