import { pick, pickBy } from '../lib/pick.mjs';

// 組合せ nCr
const comb = (n, r) => {
  let v = 1;
  for (let i = 1; i <= r; i++) v = (v * (n - r + i)) / i;
  return v;
};

// ハフマン符号の平均符号長（重みは整数、合計で割る）
const huffmanAverage = (weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  const pool = [...weights];
  let sum = 0;
  while (pool.length > 1) {
    pool.sort((a, b) => a - b);
    const merged = pool.shift() + pool.shift();
    sum += merged; // 内部節の重みの総和 = 重み付き符号長の総和
    pool.push(merged);
  }
  return sum / total;
};

// 状態遷移表（q.table）に従って文字列を受理するか
const accepts = (q, text, start, accept) => {
  const next = Object.fromEntries(q.table.rows.map(([s, on0, on1]) => [s, { 0: on0, 1: on1 }]));
  let state = start;
  for (const ch of text) state = next[state][ch];
  return state === accept;
};

// 2分探索木への挿入と後行順走査
const bstPostorder = (keys) => {
  let root = null;
  const insert = (node, k) => {
    if (!node) return { k, l: null, r: null };
    if (k < node.k) node.l = insert(node.l, k);
    else node.r = insert(node.r, k);
    return node;
  };
  for (const k of keys) root = insert(root, k);
  const out = [];
  const walk = (n) => {
    if (!n) return;
    walk(n.l);
    walk(n.r);
    out.push(n.k);
  };
  walk(root);
  return out;
};

export const checks = {
  // 16進小数 2D.A → 10進
  'a-tech-0001': (q) => pick(q, parseInt('2D', 16) + parseInt('A', 16) / 16),

  // 8ビット2の補数の範囲
  'a-tech-0002': (q) => {
    const bits = 8;
    return pick(q, `${-(2 ** (bits - 1))}〜${2 ** (bits - 1) - 1}`);
  },

  // (x AND 3C) XOR 0F
  'a-tech-0003': (q) =>
    pick(q, ((0xb6 & 0x3c) ^ 0x0f).toString(16).toUpperCase().padStart(2, '0')),

  // どちらか一方だけ保有
  'a-tech-0004': (q) => {
    const all = 120, p = 70, qq = 55, none = 20;
    const both = p + qq - (all - none);
    return pick(q, (p - both) + (qq - both));
  },

  // 少なくとも1個が不良品
  'a-tech-0005': (q) => pick(q, 1 - comb(7, 2) / comb(10, 2)),

  // ハフマン符号の平均符号長（表の出現確率を10倍した整数で計算）
  'a-tech-0006': (q) => {
    const weights = q.table.rows[0].slice(1).map((s) => Math.round(Number(s) * 10));
    return pick(q, huffmanAverage(weights));
  },

  // 有限オートマトンが受理する文字列
  'a-tech-0007': (q) => pickBy(q, (text) => accepts(q, text, 'S0', 'S2')),

  // スタックとキューの操作列
  'a-tech-0010': (q) => {
    const S = [], Q = [];
    const push = (v) => S.push(v), pop = () => S.pop();
    const enq = (v) => Q.push(v), deq = () => Q.shift();
    push(2); push(4); enq(pop()); push(6); push(9); enq(pop());
    push(deq()); enq(pop()); enq(pop()); push(deq());
    return pick(q, pop());
  },

  // 2分探索木の後行順
  'a-tech-0011': (q) => pick(q, bstPostorder([50, 30, 70, 20, 40, 60, 45]).join('→')),

  // 2分探索の比較回数
  'a-tech-0012': (q) => {
    const a = [3, 8, 12, 17, 21, 26, 30, 34, 39, 43, 48, 52, 57, 61, 66];
    const key = 39;
    let low = 1, high = a.length, count = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      count++;
      if (a[mid - 1] === key) break;
      if (a[mid - 1] < key) low = mid + 1;
      else high = mid - 1;
    }
    return pick(q, count);
  },

  // 線形探索法（オープンアドレス法）での格納位置
  'a-tech-0013': (q) => {
    const size = 11;
    const table = new Array(size).fill(null);
    let last = -1;
    for (const k of [18, 29, 41, 30, 52]) {
      let pos = k % size;
      while (table[pos] !== null) pos = (pos + 1) % size;
      table[pos] = k;
      last = pos;
    }
    return pick(q, last);
  },

  // バブルソートの交換回数
  'a-tech-0015': (q) => {
    const a = [6, 2, 9, 4, 1];
    let swaps = 0;
    for (let end = a.length - 1; end > 0; end--) {
      for (let i = 0; i < end; i++) {
        if (a[i] > a[i + 1]) {
          [a[i], a[i + 1]] = [a[i + 1], a[i]];
          swaps++;
        }
      }
    }
    return pick(q, swaps);
  },

  // 再帰関数 f(5)
  'a-tech-0016': (q) => {
    const f = (n) => (n <= 1 ? 1 : f(n - 1) + 2 * f(n - 2) + 1);
    return pick(q, f(5));
  },
};
