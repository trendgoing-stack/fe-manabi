// data/questions/b/algo-05.json の実行検証：問題のコードを擬似言語インタプリタで実行して正解を求める
import { pick, pickBy } from '../lib/pick.mjs';
import { run, traceAt } from '../../pseudo/interp.mjs';

/** trace.rows が traceAt() の結果と一致することを確かめる */
const sameTrace = (q, lines, opts, lineNo) => {
  const rows = traceAt(lines, opts, lineNo, q.trace.vars);
  if (JSON.stringify(rows) !== JSON.stringify(q.trace.rows)) throw new Error(`${q.id}: trace.rows が traceAt() の結果と一致しない`);
};

/** 空欄を選択肢の字句で埋める。「a：X　b：Y」の形なら a と b の両方を埋める */
const fill = (lines, text) => {
  const m = text.match(/^a：(.+?)　b：(.+)$/);
  const [a, b] = m ? [m[1], m[2]] : [text, null];
  return lines.map((l) => {
    let s = l.replace('［ a ］', a);
    if (b != null) s = s.replace('［ b ］', b);
    return s;
  });
};

/** 例外を値として扱う */
const tryRun = (fn) => {
  try {
    return fn();
  } catch (e) {
    return { error: e.message };
  }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b) =>
  Array.isArray(a) ? Array.isArray(b) && a.length === b.length && a.every((x, i) => near(x, b[i])) : typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9;

// 乱数（再現できるように固定の種）
const rng = (() => {
  let s = 20261115;
  return (lo, hi) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return lo + (Math.floor(s / 65536) % (hi - lo + 1));
  };
})();

// ---------- インタプリタが扱わない演算子を、組込み関数の呼出しに書き換える ----------
// ∧ ∨ ⊕（ビットごとの論理積・論理和・排他的論理和）と、実数の割り算としての ÷。
const ID = /[A-Za-z0-9_.]/;
const OPEN = { ')': '(', ']': '[' };
const CLOSE = { '(': ')', '[': ']' };

function leftOperand(s, i) {
  let j = i;
  while (j >= 0 && s[j] === ' ') j--;
  const end = j + 1;
  // 括弧のまとまり（配列の要素番号・関数の引数を含む）を左へ取り込み、最後に直前の識別子を取り込む
  while (j >= 0 && OPEN[s[j]]) {
    let depth = 0;
    for (; j >= 0; j--) {
      if (s[j] === ')' || s[j] === ']') depth++;
      else if (s[j] === '(' || s[j] === '[') depth--;
      if (depth === 0) break;
    }
    j--;
  }
  while (j >= 0 && ID.test(s[j])) j--;
  return [j + 1, end];
}

function rightOperand(s, i) {
  let k = i;
  while (k < s.length && s[k] === ' ') k++;
  const start = k;
  const group = () => {
    let depth = 0;
    for (; k < s.length; k++) {
      if (s[k] === '(' || s[k] === '[') depth++;
      else if (s[k] === ')' || s[k] === ']') depth--;
      if (depth === 0) break;
    }
    k++;
  };
  if (CLOSE[s[k]]) group();
  else {
    while (k < s.length && ID.test(s[k])) k++;
    while (k < s.length && CLOSE[s[k]]) group();
  }
  return [start, k];
}

function rewrite(line, sym, fn) {
  for (;;) {
    const i = line.indexOf(sym);
    if (i < 0) return line;
    const [ls, le] = leftOperand(line, i - 1);
    const [rs, re] = rightOperand(line, i + 1);
    const a = line.slice(ls, le);
    const b = line.slice(rs, re);
    if (!a || !b) throw new Error(`演算子 ${sym} の書き換えに失敗（${line}）`);
    line = line.slice(0, ls) + `${fn}(${a}, ${b})` + line.slice(re);
  }
}

/** 問題のコードを、インタプリタで実行できる形に書き換える */
export const prep = (lines, { real = false } = {}) =>
  lines.map((l) => {
    let s = rewrite(rewrite(rewrite(l, '∧', 'bitAnd'), '∨', 'bitOr'), '⊕', 'bitXor');
    if (real) s = rewrite(s, '÷', 'realDiv');
    return s;
  });

export const builtins = {
  bitAnd: (a, b) => a & b,
  bitOr: (a, b) => a | b,
  bitXor: (a, b) => a ^ b,
  realDiv: (a, b) => {
    if (b === 0) throw new Error('0 で割った');
    return a / b;
  },
  sqrt: Math.sqrt,
};

// 書き換え自体の確認
{
  const t = (src, want, opt) => {
    const got = prep([src], opt)[0];
    if (got !== want) throw new Error(`prep の確認に失敗: ${src} → ${got}`);
  };
  t('v ← −((x ⊕ 255) ＋ 1)', 'v ← −((bitXor(x, 255)) ＋ 1)');
  t('if ((x ∧ 128) ＝ 0)', 'if ((bitAnd(x, 128)) ＝ 0)');
  t('z の末尾に (x[i] − m) ÷ sd を追加する', 'z の末尾に realDiv((x[i] − m), sd) を追加する', { real: true });
  t('z の末尾に x[i] ÷ sd − m を追加する', 'z の末尾に realDiv(x[i], sd) − m を追加する', { real: true });
  t('g ← (s × gini(l1, l2) ＋ (n − s) × gini(t1 − l1, (n − t1) − l2)) ÷ n', 'g ← realDiv((s × gini(l1, l2) ＋ (n − s) × gini(t1 − l1, (n − t1) − l2)), n)', { real: true });
  t('sd ← sqrt(v ÷ n)', 'sd ← sqrt(realDiv(v, n))', { real: true });
}

const runQ = (lines, call, args, opt) => run(prep(lines, opt), { call, args, builtins });

export const checks = {
  // 0〜255 のすべての x で、2の補数として読んだ値を返す組合せだけを正解とする
  'b-algo-0081': (q) =>
    pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      for (let x = 0; x <= 255; x++) {
        if (tryRun(() => runQ(code, 'toSigned', [x]).value) !== (x < 128 ? x : x - 256)) return false;
      }
      return true;
    }),

  // n ＝ 1〜15 で iter(n) が rec(n) と一致する組合せだけを正解とする
  'b-algo-0082': (q) => {
    const want = [];
    for (let n = 1; n <= 15; n++) want.push(run(q.code.lines.map((l) => l.replace(/［ [ab] ］/g, 'q')), { call: 'rec', args: [n] }).value);
    if (!eq(want.slice(0, 6), [2, 1, 3, 5, 6, 9])) throw new Error(`${q.id}: rec の値が解説と違う`);
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      return want.every((w, i) => tryRun(() => run(code, { call: 'iter', args: [i + 1] }).value) === w);
    });
  },

  'b-algo-0083': (q) => {
    const ref = (data, names) => data.map((d) => names.map((nm) => (nm === d ? 1 : 0)));
    const exec = (code, data, names) => {
      const res = data.map(() => names.map(() => 0));
      const r = tryRun(() => run(code, { call: 'oneHot', args: [data, names, res] }));
      return r.error ? r : res;
    };
    const cases = [[['雑貨', '衣料', '雑貨'], ['衣料', '食品', '雑貨', '家電']]];
    const pool = ['衣料', '食品', '雑貨', '家電', '書籍'];
    for (let t = 0; t < 25; t++) {
      const names = pool.slice(0, rng(2, 5));
      const data = Array.from({ length: rng(1, 7) }, () => names[rng(0, names.length - 1)]);
      cases.push([data, names]);
    }
    if (!eq(exec(fill(q.code.lines, q.choices[q.answer].text), ...cases[0]), [[0, 0, 1, 0], [1, 0, 0, 0], [0, 0, 1, 0]])) throw new Error(`${q.id}: 例の結果が問題文と違う`);
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      return cases.every(([d, nm]) => eq(exec(code, d, nm), ref(d, nm)));
    });
  },

  'b-algo-0084': (q) => {
    const ref = (t) => {
      const rs = t.map((r) => r.reduce((a, b) => a + b, 0));
      const cs = t[0].map((_, j) => t.reduce((a, r) => a + r[j], 0));
      const total = rs.reduce((a, b) => a + b, 0);
      return t.map((r, i) => r.map((_, j) => (rs[i] * cs[j]) / total));
    };
    const t0 = q.table.rows.map((r) => r.slice(1).map(Number));
    const cases = [t0];
    for (let k = 0; k < 15; k++) {
      const r = rng(2, 4);
      const c = rng(2, 4);
      cases.push(Array.from({ length: r }, () => Array.from({ length: c }, () => rng(1, 30))));
    }
    const ok = runQ(fill(q.code.lines, q.choices[q.answer].text), 'expected', [t0], { real: true }).value;
    if (Math.abs(ok[1][0] - 25) > 1e-9) throw new Error(`${q.id}: 2行1列の期待度数が解説の25と違う`);
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      return cases.every((t) => near(tryRun(() => runQ(code, 'expected', [t], { real: true }).value), ref(t)));
    });
  },

  'b-algo-0085': (q) => {
    const cases = [];
    while (cases.length < 40) {
      const n = rng(5, 12);
      const buy = Array.from({ length: n }, () => Array.from({ length: 4 }, () => rng(0, 1)));
      const x = rng(1, 4);
      let y = rng(1, 4);
      if (y === x) y = (x % 4) + 1;
      const cx = buy.filter((r) => r[x - 1]).length;
      const cy = buy.filter((r) => r[y - 1]).length;
      const cxy = buy.filter((r) => r[x - 1] && r[y - 1]).length;
      if (!cx || !cy) continue;
      cases.push({ buy, x, y, want: cxy / cx / (cy / n) > 1 });
    }
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      return cases.every((c) => tryRun(() => run(code, { call: 'isRelated', args: [c.buy, c.x, c.y] }).value) === c.want);
    });
  },

  'b-algo-0086': (q) => {
    const code0 = q.code.lines;
    return pickBy(q, (text) => {
      const code = fill(code0, text);
      for (let k = 1; k <= 6; k++) {
        for (let lo = 1; lo <= 20; lo++) {
          for (let hi = lo; hi <= 24; hi++) {
            const want = run(code, { call: 'countA', args: [lo, hi, k] }).value;
            let c = 0;
            for (let i = lo; i <= hi; i++) if (i % k === 0) c++;
            if (want !== c) throw new Error(`${q.id}: countA が正しくない`);
            if (tryRun(() => run(code, { call: 'countB', args: [lo, hi, k] }).value) !== want) return false;
          }
        }
      }
      return true;
    });
  },

  'b-algo-0087': (q) => {
    const ref = (n) => {
      let c = 0;
      for (let z = 0; 7 * z <= n; z++) for (let y = 0; 7 * z + 5 * y <= n; y++) if ((n - 7 * z - 5 * y) % 3 === 0) c++;
      return c;
    };
    if (ref(10) !== 2) throw new Error(`${q.id}: n ＝ 10 の例が問題文と違う`);
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      for (let n = 0; n <= 45; n++) if (tryRun(() => run(code, { call: 'ways', args: [n] }).value) !== ref(n)) return false;
      return true;
    });
  },

  'b-algo-0088': (q) => {
    const keys = [58, 42, 10, 26, 82, 74, 66];
    sameTrace(q, q.code.lines, { call: 'store', args: [[0, 0, 0, 0, 0, 0, 0], keys] }, 9);
    const table = [0, 0, 0, 0, 0, 0, 0];
    const fail = run(q.code.lines, { call: 'store', args: [table, keys] }).value;
    if (fail !== 2) throw new Error(`${q.id}: 戻り値が解説の2と違う`);
    // 誤答の配列が、why に書いた誤りどおりの結果であることを確かめる
    const sim = (mode) => {
      const t = Array(7).fill(0);
      for (const x of keys) {
        let h = x % 7;
        if (mode === 'linear') {
          let k = 0;
          while (k < 7 && t[(h + k) % 7] !== 0) k++;
          if (k < 7) t[(h + k) % 7] = x;
          continue;
        }
        if (mode === 'firstOnly') {
          t[h] = x;
          continue;
        }
        if (t[h] !== 0) h = Math.floor(x / 7) % 7;
        if (mode === 'overwrite' || t[h] === 0) t[h] = x;
      }
      return `{${t.join(', ')}}`;
    };
    const texts = q.choices.map((c) => c.text);
    for (const m of ['linear', 'firstOnly', 'overwrite']) if (!texts.includes(sim(m))) throw new Error(`${q.id}: 誤答 ${m} の配列が選択肢にない`);
    return pick(q, `{${table.join(', ')}}`);
  },

  'b-algo-0089': (q) => {
    const cases = ['1F', '0', 'A', 'FF', '10', '7B3', 'C0DE', '00F'];
    for (let t = 0; t < 20; t++) cases.push(Array.from({ length: rng(1, 5) }, () => '0123456789ABCDEF'[rng(0, 15)]).join(''));
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      return cases.every((s) => tryRun(() => run(code, { call: 'hexToInt', args: [s] }).value) === parseInt(s, 16));
    });
  },

  'b-algo-0090': (q) => {
    const cases = [[3, [[1, 2], [3, 2]]]];
    for (let t = 0; t < 15; t++) {
      const n = rng(3, 5);
      cases.push([n, Array.from({ length: rng(1, 6) }, () => [rng(1, n), rng(1, n)]).filter(([u, v]) => u !== v)]);
    }
    const ref = (n, edges, directed) => {
      const m = Array.from({ length: n }, () => Array(n).fill(0));
      for (const [u, v] of edges) {
        m[u - 1][v - 1] = 1;
        if (!directed) m[v - 1][u - 1] = 1;
      }
      return m;
    };
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      return cases.every(([n, edges]) =>
        [true, false].every((directed) => {
          const adj = Array.from({ length: n }, () => Array(n).fill(0));
          const r = tryRun(() => run(code, { call: 'makeAdj', args: [adj, edges, directed] }));
          return !r.error && eq(adj, ref(n, edges, directed));
        }),
      );
    });
  },

  'b-algo-0091': (q) => {
    // 例のとおりになるか
    const ex = [10, 20, 30, 40, 50, 0];
    run(fill(q.code.lines, q.choices[q.answer].text), { call: 'insertAt', args: [ex, 5, 2, 15] });
    if (!eq(ex, [10, 15, 20, 30, 40, 50])) throw new Error(`${q.id}: 例の結果が問題文と違う`);
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      for (let n = 1; n <= 6; n++) {
        for (let p = 1; p <= n + 1; p++) {
          const vals = Array.from({ length: n }, (_, i) => (i + 1) * 10 + rng(1, 9));
          const buf = [...vals, -1, -1];
          const want = [...vals.slice(0, p - 1), 99, ...vals.slice(p - 1), -1];
          const r = tryRun(() => run(code, { call: 'insertAt', args: [buf, n, p, 99] }));
          if (r.error || !eq(buf, want)) return false;
        }
      }
      return true;
    });
  },

  'b-algo-0092': (q) => {
    const ref = (x) => {
      const m = x.reduce((a, b) => a + b, 0) / x.length;
      const sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length);
      return x.map((v) => (v - m) / sd);
    };
    const cases = [[2, 4, 6, 8]];
    while (cases.length < 20) {
      const x = Array.from({ length: rng(2, 7) }, () => rng(1, 40) / 2);
      if (new Set(x).size > 1) cases.push(x);
    }
    const ex = runQ(fill(q.code.lines, q.choices[q.answer].text), 'standardize', [[2, 4, 6, 8]], { real: true }).value;
    if (Math.abs(ex[0] - -3 / Math.sqrt(5)) > 1e-9 || ex[0].toFixed(2) !== '-1.34') throw new Error(`${q.id}: 例の値が解説と違う`);
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      return cases.every((x) => near(tryRun(() => runQ(code, 'standardize', [[...x]], { real: true }).value), ref(x)));
    });
  },

  'b-algo-0093': (q) => {
    const cases = [[[1, 1, 0, 0, 1, 0], [1, 0, 1, 1, 1, 0]]];
    while (cases.length < 30) {
      const n = rng(4, 12);
      const a = Array.from({ length: n }, () => rng(0, 1));
      const p = Array.from({ length: n }, () => rng(0, 1));
      const tp = a.filter((v, i) => v && p[i]).length;
      if (tp >= 1) cases.push([a, p]);
    }
    const ref = (a, p) => {
      const tp = a.filter((v, i) => v === 1 && p[i] === 1).length;
      const fp = a.filter((v, i) => v === 0 && p[i] === 1).length;
      const fn = a.filter((v, i) => v === 1 && p[i] === 0).length;
      return [tp / (tp + fp), tp / (tp + fn)];
    };
    if (!near(ref(...cases[0]), [0.5, 2 / 3])) throw new Error(`${q.id}: 解説の例の値が違う`);
    return pickBy(q, (text) => {
      const code = fill(q.code.lines, text);
      return cases.every(([a, p]) => near(tryRun(() => runQ(code, 'evaluate', [a, p], { real: true }).value), ref(a, p)));
    });
  },

  'b-algo-0094': (q) => {
    const label = [1, 1, 1, 1, 2, 2, 1, 1, 2, 2];
    if (!eq(q.table.rows.map((r) => Number(r[2])), label)) throw new Error(`${q.id}: 表の label と引数が違う`);
    const lines = prep(q.code.lines, { real: true });
    sameTrace(q, lines, { call: 'bestSplit', args: [label], builtins }, 18);
    // 各 s の g を記録し、最小が一意で差が十分にあることを確かめる
    const gs = [];
    run(lines, { call: 'bestSplit', args: [label], builtins, onLine: (no, env) => no === 19 && gs.push(env.g) });
    const sorted = [...gs].sort((a, b) => a - b);
    if (sorted[1] - sorted[0] < 0.02) throw new Error(`${q.id}: 最小の g と次の g の差が小さい`);
    // 誤答の根拠（最大になる s、重み付けしない平均で最小になる s）を確かめる
    if (gs.indexOf(Math.max(...gs)) + 1 !== 6) throw new Error(`${q.id}: g が最大になる s が6でない`);
    const gini = (a, b) => 1 - (a * a + b * b) / ((a + b) * (a + b));
    const t1 = label.filter((v) => v === 1).length;
    const unw = [];
    let l1 = 0;
    let l2 = 0;
    for (let s = 1; s < label.length; s++) {
      if (label[s - 1] === 1) l1++;
      else l2++;
      unw.push((gini(l1, l2) + gini(t1 - l1, label.length - t1 - l2)) / 2);
    }
    if (unw.indexOf(Math.min(...unw)) + 1 !== 8) throw new Error(`${q.id}: 重み付けしない平均で最小になる s が8でない`);
    if (Math.abs(gs[4] - 0.4) > 1e-9) throw new Error(`${q.id}: s ＝ 5 の g が0.4でない`);
    return pick(q, run(lines, { call: 'bestSplit', args: [label], builtins }).value);
  },
};
