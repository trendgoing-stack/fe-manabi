import { pick, pickBy } from '../lib/pick.mjs';
import { run, traceAt } from '../../pseudo/interp.mjs';

// ---- ヘルパー ----

const fmt = (a) => `{${a.join(', ')}}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// trace が付いていれば traceAt() の結果と一致することを確かめる
const checkTrace = (q, lines, opt, lineNo) => {
  if (!q.trace) throw new Error(`${q.id}: trace がない`);
  const rows = traceAt(lines, opt, lineNo, q.trace.vars);
  if (!same(rows, q.trace.rows)) throw new Error(`${q.id}: trace.rows が traceAt() の結果と一致しない`);
};

// 空欄［ a ］を選択肢の字句で埋める
const fill = (lines, text) => lines.map((l) => l.replace('［ a ］', text));

// 実行して例外（範囲外・無限ループなど）なら null
const tryRun = (lines, opt) => {
  try {
    return run(lines, { maxSteps: 20000, ...opt });
  } catch {
    return null;
  }
};

// 整列の確認用の入力
const SORT_INPUTS = [
  [3, 4, 1],
  [5, 2, 9, 1, 7],
  [4, 4, 2, 8, 2],
  [1, 2, 3, 4],
  [9, 7, 5, 3, 1],
  [6],
  [2, 1],
  [12, 3, 7, 3, 0, 15, 8, 1],
];
const asc = (a) => [...a].sort((x, y) => x - y);
const desc = (a) => [...a].sort((x, y) => y - x);

// 手続を実行した後の配列が期待どおりか（引数の配列は参照渡しで書き換わる）
const sortsInPlace = (lines, call, expect) =>
  SORT_INPUTS.every((inp) => {
    const a = [...inp];
    return tryRun(lines, { call, args: [a] }) !== null && same(a, expect(inp));
  });

export const checks = {
  // 番兵付き線形探索：5行目の条件式の評価回数
  'b-algo-0021': (q) => pick(q, run(q.code.lines, { call: 'findPos', args: [[8, 15, 3, 15, 22], 9] }).counts.get(5)),

  // バブルソートの交換回数
  'b-algo-0022': (q) => {
    const opt = { call: 'bubbleSort', args: [[5, 2, 6, 1, 4]] };
    checkTrace(q, q.code.lines, opt, 6);
    return pick(q, run(q.code.lines, { call: 'bubbleSort', args: [[5, 2, 6, 1, 4]] }).globals.swaps);
  },

  // 選択ソート：i = 3 の処理を終えた直後（i = 4 で4行目に来たとき）の a
  'b-algo-0023': (q) => {
    checkTrace(q, q.code.lines, { call: 'selectionSort', args: [[7, 3, 9, 2, 5, 4]] }, 10);
    const rows = traceAt(q.code.lines, { call: 'selectionSort', args: [[7, 3, 9, 2, 5, 4]] }, 4, ['i', 'a']);
    return pick(q, rows.find((r) => r[0] === '4')[1]);
  },

  // 挿入ソートの空欄：昇順に正しく整列できる選択肢
  'b-algo-0024': (q) => pickBy(q, (t) => sortsInPlace(fill(q.code.lines, t), 'insertionSort', asc)),

  // 2分探索：mid の値の並び
  'b-algo-0025': (q) => {
    const data = [4, 9, 13, 18, 22, 27, 31, 36, 40, 45, 51];
    checkTrace(q, q.code.lines, { call: 'binSearch', args: [data, 33] }, 6);
    return pick(q, traceAt(q.code.lines, { call: 'binSearch', args: [data, 33] }, 7, ['mid']).map((r) => r[0]).join(', '));
  },

  // クイックソート：最初の呼出しで19行目に来たときの a
  'b-algo-0026': (q) => pick(q, traceAt(q.setCode.lines, { call: 'quickSort', args: [[6, 2, 8, 3, 9, 5], 1, 6] }, 19, ['a'])[0][0]),

  // クイックソート：呼出し回数（2行目は呼出しごとに1回実行される）
  'b-algo-0027': (q) => pick(q, run(q.setCode.lines, { call: 'quickSort', args: [[6, 2, 8, 3, 9, 5], 1, 6] }).counts.get(2)),

  // クイックソート：9行目の比較回数が最大になる初期内容（最大がただ1つであること）
  'b-algo-0028': (q) => {
    const cnt = q.choices.map((c) => {
      const a = JSON.parse(c.text.replace(/[{}]/g, (m) => (m === '{' ? '[' : ']')));
      const r = run(q.setCode.lines, { call: 'quickSort', args: [a, 1, a.length] });
      if (!same(a, asc(a))) throw new Error(`${q.id}: 整列されていない`);
      return r.counts.get(9);
    });
    const max = Math.max(...cnt);
    return pickBy(q, (_, i) => cnt[i] === max);
  },

  // 再帰の戻り値
  'b-algo-0029': (q) => {
    checkTrace(q, q.code.lines, { call: 'sumOdd', args: [9] }, 2);
    return pick(q, run(q.code.lines, { call: 'sumOdd', args: [9] }).value);
  },

  // 再帰の呼出し回数
  'b-algo-0030': (q) => pick(q, run(q.code.lines, { call: 'f', args: [7] }).globals.calls),

  // マージの空欄：複数の入力で正しく併合できる選択肢
  'b-algo-0031': (q) => {
    const cases = [
      [[1, 4, 9], [2, 3]],
      [[2, 3], [1, 4, 9]],
      [[1, 5, 6, 8], [7]],
      [[5], [1, 2, 3]],
      [[], [3, 4]],
      [[3, 4], []],
      [[2, 2, 7], [2, 6, 10]],
    ];
    return pickBy(q, (t) => {
      const lines = fill(q.code.lines, t);
      return cases.every(([x, y]) => {
        const r = tryRun(lines, { call: 'merge', args: [[...x], [...y]] });
        return r !== null && same(r.value, asc([...x, ...y]));
      });
    });
  },

  // 計数ソートの空欄
  'b-algo-0032': (q) => {
    const cases = [
      [[3, 0, 2, 3, 1], 3],
      [[5, 1, 4, 1, 0, 5, 2], 5],
      [[2, 2, 2], 4],
      [[0], 0],
    ];
    return pickBy(q, (t) => {
      const lines = fill(q.code.lines, t);
      return cases.every(([a, m]) => {
        const r = tryRun(lines, { call: 'countSort', args: [[...a], m] });
        return r !== null && same(r.value, asc(a));
      });
    });
  },

  // 交換が無ければ打ち切るバブルソート：8行目の比較回数
  'b-algo-0033': (q) => {
    checkTrace(q, q.code.lines, { call: 'bubbleSort2', args: [[3, 1, 2, 4, 5, 6]] }, 15);
    const a = [3, 1, 2, 4, 5, 6];
    const r = run(q.code.lines, { call: 'bubbleSort2', args: [a] });
    if (!same(a, asc(a))) throw new Error(`${q.id}: 整列されていない`);
    return pick(q, r.counts.get(8));
  },

  // 誤りのある2分探索：終了しなくなる key
  'b-algo-0034': (q) => {
    const d = [3, 8, 14, 20, 27, 35];
    const loops = (key) => {
      try {
        run(q.code.lines, { call: 'search', args: [d, key], maxSteps: 10000 });
        return false;
      } catch (e) {
        if (/上限/.test(e.message)) return true;
        throw e;
      }
    };
    return pickBy(q, (t) => loops(Number(t)));
  },

  // マージソート：呼出し回数（3行目は呼出しごとに1回実行される）
  'b-algo-0035': (q) => {
    const r = run(q.setCode.lines, { call: 'mergeSort', args: [[5, 1, 7, 3, 6, 2, 4]] });
    if (!same(r.value, [1, 2, 3, 4, 5, 6, 7])) throw new Error(`${q.id}: 整列されていない`);
    return pick(q, r.counts.get(3));
  },

  // マージソート：比較回数
  'b-algo-0036': (q) => pick(q, run(q.setCode.lines, { call: 'mergeSort', args: [[5, 1, 7, 3, 6, 2, 4]] }).globals.comps),

  // マージソート：comps が最小になる配列（最小がただ1つであること）
  'b-algo-0037': (q) => {
    const cnt = q.choices.map((c) => {
      const a = JSON.parse(c.text.replace('{', '[').replace('}', ']'));
      return run(q.setCode.lines, { call: 'mergeSort', args: [a] }).globals.comps;
    });
    const min = Math.min(...cnt);
    return pickBy(q, (_, i) => cnt[i] === min);
  },

  // べき乗の分割統治：乗算回数
  'b-algo-0038': (q) => {
    checkTrace(q, q.code.lines, { call: 'power', args: [3, 13] }, 8);
    const r = run(q.code.lines, { call: 'power', args: [3, 13] });
    if (r.value !== 3 ** 13) throw new Error(`${q.id}: 値が 3^13 でない`);
    return pick(q, r.globals.mul);
  },

  // 降順整列の誤り修正：修正後に降順に整列できる選択肢
  'b-algo-0039': (q) => {
    const L = q.code.lines;
    // 現状では昇順になることを確かめる
    const a0 = [4, 9, 2, 7];
    run(L, { call: 'sortDesc', args: [a0] });
    if (!same(a0, [2, 4, 7, 9])) throw new Error(`${q.id}: 問題文の実行結果と一致しない`);
    const edit = (no, from, to) => L.map((l, i) => (i === no - 1 ? (l.includes(from) ? l.replace(from, to) : (() => { throw new Error(`${q.id}: ${no}行目に「${from}」がない`); })()) : l));
    const patched = (t) => {
      const m = t.match(/^(\d+)行目の (.+) を (.+) にする$/);
      if (!m) throw new Error(`${q.id}: 選択肢を解釈できない（${t}）`);
      return edit(Number(m[1]), m[2], m[3]);
    };
    return pickBy(q, (t) => sortsInPlace(patched(t), 'sortDesc', desc));
  },

  // 値が等しい要素の組の数（戻り値）
  'b-algo-0040': (q) => {
    const a = [2, 5, 2, 7, 5, 2];
    const r = run(q.code.lines, { call: 'countPairs', args: [a] });
    let want = 0;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] === a[j]) want++;
    if (r.value !== want || r.counts.get(7) !== want) throw new Error(`${q.id}: 組の数が一致しない`);
    return pick(q, r.value);
  },
};
