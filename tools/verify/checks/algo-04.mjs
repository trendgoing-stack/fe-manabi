// data/questions/b/algo-04.json の実行検証：問題のコードを擬似言語インタプリタで実行して正解を求める
import { pick, pickBy } from '../lib/pick.mjs';
import { run, traceAt } from '../../pseudo/interp.mjs';

/** trace.rows が traceAt() の結果と一致することを確かめる */
const sameTrace = (q, lines, opts, lineNo) => {
  const rows = traceAt(lines, opts, lineNo, q.trace.vars);
  if (JSON.stringify(rows) !== JSON.stringify(q.trace.rows)) throw new Error(`${q.id}: trace.rows が traceAt() の結果と一致しない`);
};

/** 空欄 ［ a ］ を選択肢の字句で埋める */
const fill = (lines, text) => lines.map((l) => l.replace('［ a ］', text));

/** 「n行目を …… に修正する」などの記述から、行を差し替えたコードを作る */
const replaceLine = (lines, no, text) => lines.map((l, i) => (i === no - 1 ? l.match(/^\s*/)[0] + text : l));

/** 例外を値として扱う */
const tryRun = (fn) => {
  try {
    return fn();
  } catch (e) {
    return { error: e.message };
  }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 乱数（再現できるように固定の種）
const rng = (() => {
  let s = 12345;
  return (lo, hi) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return lo + (s % (hi - lo + 1));
  };
})();
const randMat = (n) => Array.from({ length: n }, () => Array.from({ length: n }, () => rng(-5, 9)));

// 選択肢の数値表記（「−1」など）を数値にする
const toNum = (s) => Number(String(s).replace(/−/g, '-'));
const parseArr = (s) => s.replace(/[{}\s]/g, '').split(',').map(toNum);
const parseTriple = (s) => {
  const m = s.match(/temp = (\d+), hum = (\d+), wind = (\d+)/);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

export const checks = {
  'b-algo-0061': (q) => {
    const opts = { call: 'gcd', args: [126, 48] };
    sameTrace(q, q.code.lines, opts, 4);
    return pick(q, run(q.code.lines, opts).counts.get(4));
  },

  'b-algo-0062': (q) => {
    // 1〜200 のすべての n で素数判定が正しい字句だけを正解とする
    const isPrime = (n) => n >= 2 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((d) => n % d !== 0);
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      for (let n = 1; n <= 200; n++) {
        const r = tryRun(() => run(code, { call: 'isPrime', args: [n] }).value);
        if (r !== isPrime(n)) return false;
      }
      return true;
    });
  },

  'b-algo-0063': (q) => {
    const r = run(q.code.lines, { call: 'countPrimes', args: [30] });
    if (r.value !== 10) throw new Error(`${q.id}: 素数の個数が10でない`);
    return pick(q, r.counts.get(13));
  },

  'b-algo-0064': (q) => {
    const opts = { call: 'toBase', args: [77, 4] };
    sameTrace(q, q.code.lines, opts, 8);
    const v = run(q.code.lines, opts).value;
    if (v !== (77).toString(4)) throw new Error(`${q.id}: 基数変換の結果が正しくない`);
    return pick(q, v);
  },

  'b-algo-0065': (q) => {
    const opts = { call: 'checkDigit', args: [[5, 1, 8, 6, 3]] };
    sameTrace(q, q.code.lines, opts, 5);
    return pick(q, run(q.code.lines, opts).value);
  },

  'b-algo-0066': (q) => {
    const opts = { call: 'encode', args: ['GGGTAACCCC'] };
    sameTrace(q, q.code.lines, opts, 10);
    return pick(q, run(q.code.lines, opts).value);
  },

  'b-algo-0067': (q) => {
    const r = run(q.code.lines, { call: 'search', args: ['TACGTAGTAC', 'GTAC'] });
    if (r.value !== 'TACGTAGTAC'.indexOf('GTAC') + 1) throw new Error(`${q.id}: 照合位置が正しくない`);
    return pick(q, r.counts.get(7));
  },

  'b-algo-0068': (q) => {
    const ref = (x, y) => x.map((row, i) => y.map((_, j) => row.reduce((s, _v, k) => s + x[i][k] * y[k][j], 0)));
    const cases = [];
    for (const n of [2, 3, 4]) for (let t = 0; t < 3; t++) cases.push([randMat(n), randMat(n)]);
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      return cases.every(([x, y]) => eq(tryRun(() => run(code, { call: 'matMul', args: [x, y] }).value), ref(x, y)));
    });
  },

  'b-algo-0069': (q) => {
    // 元のコードは転置しない（問題文の前提）
    const m0 = randMat(3);
    const before = JSON.stringify(m0);
    run(q.code.lines, { call: 'transpose', args: [m0] });
    if (JSON.stringify(m0) !== before) throw new Error(`${q.id}: 元のコードで m が変化した`);
    const transposed = (m) => m.map((row, i) => row.map((_, j) => m[j][i]));
    return pickBy(q, (text) => {
      const code = replaceLine(q.code.lines, 5, text);
      for (const n of [2, 3, 4, 5]) {
        const m = randMat(n);
        const want = transposed(m);
        const r = tryRun(() => run(code, { call: 'transpose', args: [m] }));
        if (r.error || !eq(m, want)) return false;
      }
      return true;
    });
  },

  'b-algo-0070': (q) => {
    const vec = Object.fromEntries(q.table.rows.map((r) => [r[0], r.slice(1).map(Number)]));
    const sims = ['D1', 'D2', 'D3'].map((name) => {
      const v = run(q.code.lines, { call: 'cosSim', args: [vec.q, vec[name]], builtins: { sqrt: Math.sqrt } }).value;
      if (Number.isInteger(v)) throw new Error(`${q.id}: 類似度が整数になり、整数の割り算と区別できない`);
      return { name, v };
    });
    sims.sort((a, b) => b.v - a.v);
    if (sims[0].v - sims[1].v < 0.01 || sims[1].v - sims[2].v < 0.01) throw new Error(`${q.id}: 類似度の差が小さすぎる`);
    return pick(q, sims.map((s) => s.name).join(', '));
  },

  'b-algo-0071': (q) => {
    const px = q.table.rows.map((r) => toNum(r[1]));
    const py = q.table.rows.map((r) => toNum(r[2]));
    const lab = q.table.rows.map((r) => toNum(r[3]));
    sameTrace(q, q.code.lines, { call: 'knn', args: [px, py, lab, 5, 5, 3] }, 15);
    const v1 = run(q.code.lines, { call: 'knn', args: [px, py, lab, 5, 5, 1] }).value;
    const v3 = run(q.code.lines, { call: 'knn', args: [px, py, lab, 5, 5, 3] }).value;
    const f = (v) => (v < 0 ? `−${-v}` : String(v));
    return pick(q, `k = 1 のとき ${f(v1)}、k = 3 のとき ${f(v3)}`);
  },

  // 0/1 の入力8通りのうち戻り値が1になる個数
  'b-algo-0072': (q) => {
    let c = 0;
    for (let k = 0; k < 8; k++) {
      const x = [(k >> 2) & 1, (k >> 1) & 1, k & 1];
      if (run(q.code.lines, { call: 'neuron', args: [x, [2, -3, 1], 2] }).value === 1) c++;
    }
    return pick(q, c);
  },

  'b-algo-0073': (q) => {
    const correct = replaceLine(q.code.lines, 2, '整数型: i, mx ← a[1], mn ← a[1]');
    return pickBy(q, (text) => {
      const a = parseArr(text.replace('a = ', ''));
      const want = Math.max(...a) - Math.min(...a);
      if (run(correct, { call: 'range', args: [[...a]] }).value !== want) throw new Error(`${q.id}: 正しいコードの結果が期待値と違う`);
      return run(q.code.lines, { call: 'range', args: [[...a]] }).value !== want;
    });
  },

  'b-algo-0074': (q) => {
    const ref = (a, k) => a.slice(k - 1).map((_, i) => Math.trunc(a.slice(i, i + k).reduce((s, x) => s + x, 0) / k));
    const a0 = [3, 9, 6, 12, 6, 3, 9];
    if (!eq(run(q.code.lines, { call: 'movingAvg', args: [a0, 3] }).value, [6, 7, 7, 4, 5])) throw new Error(`${q.id}: 誤ったコードの出力が問題文と違う`);
    if (!eq(ref(a0, 3), [6, 9, 8, 7, 6])) throw new Error(`${q.id}: 期待値が問題文と違う`);
    const cases = [[a0, 3]];
    for (let t = 0; t < 20; t++) {
      const len = rng(1, 9);
      const a = Array.from({ length: len }, () => rng(0, 30));
      cases.push([a, rng(1, len)]);
    }
    return pickBy(q, (text) => {
      const m = text.match(/^(\d+)行目(?:の条件)?を (.+) に修正する$/);
      const no = Number(m[1]);
      const body = m[2].startsWith('i ') ? `if (${m[2]})` : m[2];
      const code = replaceLine(q.code.lines, no, body);
      return cases.every(([a, k]) => eq(tryRun(() => run(code, { call: 'movingAvg', args: [[...a], k] }).value), ref(a, k)));
    });
  },

  // ---------- set: 在庫のシミュレーション ----------
  'b-algo-0075': (q) => {
    const opts = { call: 'simulate', args: [[4, 6, 3, 5, 7, 2, 6, 4], 12, 4, 10, 2] };
    sameTrace(q, q.setCode.lines, opts, 17);
    return pick(q, run(q.setCode.lines, opts).value);
  },

  'b-algo-0076': (q) =>
    pick(q, run(q.setCode.lines, { call: 'simulate', args: [[4, 6, 3, 5, 7, 2, 6, 4], 12, 4, 10, 2] }).counts.get(18) ?? 0),

  'b-algo-0077': (q) => {
    for (let r = 0; r <= 100; r++) {
      if (run(q.setCode.lines, { call: 'simulate', args: [[4, 6, 3, 5, 7, 2, 6, 4], 12, r, 10, 2] }).value === 0) return pick(q, r);
    }
    throw new Error(`${q.id}: 欠品が0になる r が見つからない`);
  },

  // ---------- set: 決定木による開催判定 ----------
  'b-algo-0078': (q) => pickBy(q, (text) => run(q.setCode.lines, { call: 'judge', args: parseTriple(text) }).value === 2),

  'b-algo-0079': (q) => {
    const v = run(q.setCode.lines, { call: 'countAll', args: [[28, 33, 12, 18, 31, 9], [40, 75, 45, 80, 60, 70], [3, 5, 2, 12, 4, 6]] }).value;
    return pick(q, `{${v.join(', ')}}`);
  },

  'b-algo-0080': (q) => {
    const wrong = replaceLine(q.setCode.lines, 4, 'elseif (temp ＞ 30)');
    return pickBy(q, (text) => {
      const args = parseTriple(text);
      return run(q.setCode.lines, { call: 'judge', args }).value !== run(wrong, { call: 'judge', args }).value;
    });
  },
};
