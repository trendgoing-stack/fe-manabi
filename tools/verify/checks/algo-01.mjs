// data/questions/b/algo-01.json の実行検証。コードをインタプリタで実行して正解の選択肢を求める。
import { pick, pickBy } from '../lib/pick.mjs';
import { run, traceAt } from '../../pseudo/interp.mjs';

const BLANK = '［ a ］';
const minus = (v) => String(v).replace(/-/g, '−');
const fmtArr = (a) => `{${a.map(minus).join(', ')}}`;

/** trace の rows が traceAt の結果と一致することを確かめる */
function checkTrace(q, lines, callOpts, lineNo) {
  const rows = traceAt(lines, callOpts, lineNo, q.trace.vars);
  if (JSON.stringify(rows) !== JSON.stringify(q.trace.rows)) {
    throw new Error(`${q.id}: trace.rows が traceAt の結果と一致しない（${JSON.stringify(rows)}）`);
  }
}

/** 空欄を選択肢で埋めたコードが、すべてのテストで期待どおりに動くか */
function fills(lines, text, tests, call) {
  const filled = lines.map((l) => l.replace(BLANK, text));
  return tests.every(([args, expected]) => {
    try {
      return run(filled, { call, args }).value === expected;
    } catch {
      return false;
    }
  });
}

/** 選択肢の文言から呼出し引数を取り出す（canBorrow(10, true, 0) など） */
const parseArgs = (text) =>
  text
    .match(/\((.*)\)/)[1]
    .split(',')
    .map((s) => s.trim())
    .map((s) => (s === 'true' ? true : s === 'false' ? false : Number(s)));

export const checks = {
  'b-algo-0001': (q) => {
    const [x, y] = run(q.code.lines, { call: 'main' }).output[0].split(' ');
    return pickBy(q, (t) => t === `x は ${x}、y は ${y}`);
  },

  'b-algo-0002': (q) => pick(q, run(q.code.lines, { call: 'fee', args: [10, true] }).value),

  'b-algo-0003': (q) => pick(q, run(q.code.lines, { call: 'countPairs', args: [6] }).counts.get(5)),

  'b-algo-0004': (q) => {
    const o = { call: 'maxPos', args: [[4, 9, 2, 9, 6]] };
    checkTrace(q, q.code.lines, o, 4);
    return pick(q, run(q.code.lines, o).value);
  },

  'b-algo-0005': (q) => {
    const ref = (d, lo, hi) => d.filter((v) => v >= lo && v <= hi).length;
    const cases = [
      [[3, 8, 5, 10, 1, 7], 5, 8],
      [[2, 4, 6, 8], 4, 4],
      [[1, 9, 10, 0], 1, 9],
      [[], 0, 3],
    ];
    const tests = cases.map(([d, lo, hi]) => [[d, lo, hi], ref(d, lo, hi)]);
    return pickBy(q, (t) => fills(q.code.lines, t, tests, 'countIn'));
  },

  'b-algo-0006': (q) => pickBy(q, (t) => run(q.code.lines, { call: 'canBorrow', args: parseArgs(t) }).value === true),

  'b-algo-0007': (q) => pickBy(q, (t) => t === run(q.code.lines, { call: 'main' }).output[0]),

  'b-algo-0008': (q) => pick(q, Number(run(q.code.lines, { call: 'main' }).output[0])),

  'b-algo-0009': (q) => {
    const lines = q.code.lines;
    const inputs = [[1, 2, 3, 4], [5, 6, 7], [9, 8, 7, 6, 5, 4], [1]];
    const reverses = (ls) =>
      inputs.every((inp) => {
        const a = inp.slice();
        try {
          run(ls, { call: 'reverse', args: [a] });
        } catch {
          return false;
        }
        return JSON.stringify(a) === JSON.stringify(inp.slice().reverse());
      });
    // 修正前は要求を満たさない（要素数1の配列以外）
    if (reverses(lines)) throw new Error(`${q.id}: 修正前のコードが既に正しく動いている`);
    return pickBy(q, (t) => {
      const fixed = lines.slice();
      let m;
      if ((m = t.match(/^(\d+)行目を「(.+)」に改める$/))) {
        const n = Number(m[1]);
        fixed[n - 1] = fixed[n - 1].match(/^\s*/)[0] + m[2];
      } else if ((m = t.match(/^(\d+)行目の「(.+)」を「(.+)」に改める$/))) {
        const n = Number(m[1]);
        if (!fixed[n - 1].includes(m[2])) throw new Error(`${q.id}: ${n}行目に「${m[2]}」がない`);
        fixed[n - 1] = fixed[n - 1].replace(m[2], m[3]);
      } else throw new Error(`${q.id}: 選択肢を解釈できない（${t}）`);
      return reverses(fixed);
    });
  },

  'b-algo-0010': (q) => {
    const o = { call: 'revNum', args: [4070] };
    checkTrace(q, q.code.lines, o, 4);
    return pick(q, run(q.code.lines, o).value);
  },

  'b-algo-0011': (q) => {
    const o = { call: 'reduce', args: [21, 9] };
    checkTrace(q, q.code.lines, o, 9);
    const seq = traceAt(q.code.lines, o, 9, ['x', 'y'])
      .map(([x, y]) => `(${x}, ${y})`)
      .join(' → ');
    return pickBy(q, (t) => t === seq);
  },

  'b-algo-0012': (q) => {
    const words = ['level', 'noon', 'abab', 'aaab', 'abca', 'abba', 'x', 'xy', 'racecar'];
    const tests = words.map((w) => [[w], w === [...w].reverse().join('')]);
    return pickBy(q, (t) => fills(q.code.lines, t, tests, 'isPal'));
  },

  'b-algo-0013': (q) => {
    const data = [45, 80, 19, 100, 60, 39, 20];
    checkTrace(q, q.code.lines, { call: 'tally', args: [data.slice()] }, 9);
    return pickBy(q, (t) => t === fmtArr(run(q.code.lines, { call: 'tally', args: [data.slice()] }).value));
  },

  'b-algo-0014': (q) => pickBy(q, (t) => t === run(q.code.lines, { call: 'main' }).output.join(', ')),

  'b-algo-0015': (q) => {
    const o = { call: 'encode', args: ['ppqqqr'] };
    checkTrace(q, q.setCode.lines, o, 9);
    return pick(q, `"${run(q.setCode.lines, o).value}"`);
  },

  'b-algo-0016': (q) =>
    pickBy(q, (t) => {
      const s = t.replace(/"/g, '');
      return run(q.setCode.lines, { call: 'encode', args: [s] }).value.length > s.length;
    }),

  'b-algo-0017': (q) => {
    const o = { call: 'longestRise', args: [[3, 5, 8, 2, 4, 6, 9, 1]] };
    checkTrace(q, q.setCode.lines, o, 4);
    return pick(q, run(q.setCode.lines, o).value);
  },

  'b-algo-0018': (q) =>
    pick(q, run(q.setCode.lines, { call: 'longestRise', args: [[3, 5, 8, 2, 4, 6, 9, 1]] }).counts.get(7) ?? 0),

  'b-algo-0019': (q) => pick(q, Number(run(q.setCode.lines, { call: 'main' }).output[0])),

  'b-algo-0020': (q) => pickBy(q, (t) => t === fmtArr(run(q.setCode.lines, { call: 'main' }).globals.hist)),
};
