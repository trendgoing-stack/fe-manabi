import { pick, pickBy } from '../lib/pick.mjs';
import { run, traceAt } from '../../pseudo/interp.mjs';

// ---- ヘルパー ----

const fmt = (v) => (Array.isArray(v) ? `{${v.map(fmt).join(', ')}}` : String(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (v) => JSON.parse(JSON.stringify(v));

// trace の rows が traceAt() の結果と一致するか（行番号は caption の「n行目」から読む）
const checkTrace = (q, lines, o) => {
  const lineNo = Number(q.trace.caption.match(/(\d+)行目/)[1]);
  const rows = traceAt(lines, o, lineNo, q.trace.vars);
  if (!same(rows, q.trace.rows)) throw new Error(`${q.id}: trace.rows が traceAt と一致しない（${JSON.stringify(rows)}）`);
};

// 空欄［ a ］を選択肢の文字列で埋める
const fill = (lines, text) => lines.map((l) => l.replace('［ a ］', text));

// 例外が出たら false
const safe = (fn) => {
  try {
    return fn();
  } catch {
    return false;
  }
};

// 連結リストを head からたどって値を並べる（循環したら null）
const walkList = (val, nxt, head) => {
  const out = [];
  for (let p = head; p !== 0; p = nxt[p - 1]) {
    if (out.length > val.length || p < 1 || p > val.length || !Number.isInteger(p)) return null;
    out.push(val[p - 1]);
  }
  return out;
};

// 「n行目を「X」に変更する」「n行目の「X」をm行目の前に移す」を行の配列に当てはめる
const applyFix = (lines, text) => {
  const out = [...lines];
  let m;
  if ((m = text.match(/^(\d+)行目を「(.+)」に変更する$/))) {
    const i = Number(m[1]) - 1;
    const indent = out[i].match(/^\s*/)[0];
    out[i] = indent + m[2];
    return out;
  }
  if ((m = text.match(/^(\d+)行目の「(.+)」を(\d+)行目の前に移す$/))) {
    const from = Number(m[1]) - 1;
    const to = Number(m[3]) - 1;
    if (out[from].trim() !== m[2]) throw new Error(`修正対象の行が「${m[2]}」でない`);
    const [line] = out.splice(from, 1);
    out.splice(to, 0, out[to].match(/^\s*/)[0] + line.trim());
    return out;
  }
  throw new Error(`修正の書き方を解釈できない：${text}`);
};

// 循環バッファの題材に、操作を順に呼び出す手続を付けて実行する
const queueRun = (setLines, ops) => {
  const lines = [...setLines, '○drive()', ...ops.map((op) => `  ${op}`)];
  return run(lines, { call: 'drive' });
};

// 2分探索木の中間順（配列は要素番号1から）
const inorder = (val, lft, rgt) => {
  const out = [];
  const go = (p, depth) => {
    if (p === 0) return;
    if (depth > val.length || !Number.isInteger(p) || p < 1 || p > val.length) throw new Error('不正な木');
    go(lft[p - 1], depth + 1);
    out.push(val[p - 1]);
    go(rgt[p - 1], depth + 1);
  };
  go(1, 0);
  return out;
};

// set 題材の表から配列を読む
const tableRow = (q, name) => q.setTable.rows.find((r) => r[0] === name).slice(1).map(Number);

export const checks = {
  'b-algo-0041': (q) => pick(q, run(q.code.lines, { call: 'main' }).output.join(', ')),

  'b-algo-0042': (q) => {
    const o = { call: 'nextGreater', args: [[4, 9, 6, 2, 7, 5]] };
    checkTrace(q, q.code.lines, o);
    return pick(q, fmt(run(q.code.lines, o).value));
  },

  'b-algo-0043': (q) => {
    const [val, nxt] = q.table.rows.map((r) => r.slice(1).map(Number));
    return pick(q, run(q.code.lines, { call: 'printList', args: [val, nxt, 2] }).output.join(', '));
  },

  'b-algo-0044': (q) => {
    // 8, 15, 40, 999(番兵) のリストに 33（要素5）を挿入する
    const ok = (text) =>
      safe(() => {
        const val = [15, 40, 999, 8, 33];
        const nxt = [2, 3, 0, 1, 0];
        const r = run(fill(q.code.lines, text), { call: 'insert', args: [val, nxt, 5], globals: { head: 4 } });
        return same(walkList(val, nxt, r.globals.head), [8, 15, 33, 40, 999]);
      });
    return pickBy(q, ok);
  },

  'b-algo-0045': (q) => {
    const base = { val: [10, 20, 30, 40], nxt: [2, 3, 4, 0] };
    const cases = [[10, [20, 30, 40]], [30, [10, 20, 40]], [40, [10, 20, 30]], [99, [10, 20, 30, 40]]];
    const works = (lines) =>
      cases.every(([x, expect]) =>
        safe(() => {
          const val = clone(base.val);
          const nxt = clone(base.nxt);
          const r = run(lines, { call: 'remove', args: [val, nxt, x], globals: { head: 1 } });
          return same(walkList(val, nxt, r.globals.head), expect);
        }),
      );
    if (works(q.code.lines)) throw new Error(`${q.id}: 修正前のプログラムが正しく動いてしまう`);
    return pickBy(q, (text) => works(applyFix(q.code.lines, text)));
  },

  'b-algo-0046': (q) => {
    checkTrace(q, q.code.lines, { call: 'main' });
    return pick(q, fmt(run(q.code.lines, { call: 'main' }).globals.heap));
  },

  'b-algo-0047': (q) => {
    const h = [6, 11, 9, 15, 13, 10, 18, 21];
    let n = 8;
    for (let k = 0; k < 2; k++) n = run(q.code.lines, { call: 'removeMin', args: [h], globals: { n } }).globals.n;
    return pick(q, fmt(h.slice(0, n)));
  },

  'b-algo-0048': (q) => {
    const o = { call: 'build', args: [[24, 13, 31, 20, 8, 15]] };
    checkTrace(q, q.code.lines, o);
    return pick(q, fmt(run(q.code.lines, o).value));
  },

  'b-algo-0049': (q) => {
    const ops = ['enqueue(3)', 'enqueue(8)', 'dequeue()', 'enqueue(6)', 'enqueue(1)', 'enqueue(9)', 'enqueue(4)', 'dequeue()', 'enqueue(7)'];
    return pick(q, fmt(queueRun(q.setCode.lines, ops).globals.buf));
  },

  'b-algo-0050': (q) => {
    const states = [
      { buf: [4, 7, 6, 1, 9], head: 3, cnt: 5, expect: ['6', '1', '9', '4', '7'] },
      { buf: [5, 2, 0, 0, 0], head: 1, cnt: 2, expect: ['5', '2'] },
      { buf: [3, 4, 0, 0, 8], head: 5, cnt: 3, expect: ['8', '3', '4'] },
    ];
    const ok = (text) =>
      states.every((s) =>
        safe(() => {
          const lines = [...q.setCode.lines, ...fill(q.code.lines, text)];
          const r = run(lines, { call: 'show', globals: { buf: [...s.buf], head: s.head, cnt: s.cnt } });
          return same(r.output, s.expect);
        }),
      );
    return pickBy(q, ok);
  },

  'b-algo-0051': (q) => {
    const ops = [
      ...[11, 12, 13, 14, 15, 16].map((v) => `enqueue(${v})`),
      ...Array(4).fill('dequeue()'),
      ...[17, 18, 19].map((v) => `enqueue(${v})`),
      ...Array(2).fill('dequeue()'),
    ];
    const g = queueRun(q.setCode.lines, ops).globals;
    return pickBy(q, (t) => t === `head＝${g.head}, cnt＝${g.cnt}`);
  },

  'b-algo-0052': (q) => {
    const adj = q.table.rows.map((r) => r.slice(1).map(Number));
    const o = { call: 'bfs', args: [adj, 3] };
    checkTrace(q, q.code.lines, o);
    return pick(q, run(q.code.lines, o).output.join(', '));
  },

  'b-algo-0053': (q) => pick(q, run(q.code.lines, { call: 'dfs', args: [1] }).output.join(', ')),

  'b-algo-0054': (q) => {
    const m = q.table.rows.map((r) => r.slice(1).map(Number));
    return pick(q, run(q.code.lines, { call: 'steps', args: [m] }).value);
  },

  'b-algo-0055': (q) => {
    // 表の辺から重みの行列を作る
    const w = Array.from({ length: 5 }, () => Array(5).fill(0));
    q.table.header.slice(1).forEach((h, k) => {
      const [a, b] = h.split('と').map(Number);
      w[a - 1][b - 1] = w[b - 1][a - 1] = Number(q.table.rows[0][k + 1]);
    });
    const o = { call: 'shortest', args: [w, 1] };
    checkTrace(q, q.code.lines, o);
    return pick(q, run(q.code.lines, o).value[4]);
  },

  'b-algo-0056': (q) => {
    const r = run(q.setCode.lines, { call: 'find', args: [tableRow(q, 'val'), tableRow(q, 'lft'), tableRow(q, 'rgt'), 37] });
    return pick(q, r.value);
  },

  'b-algo-0057': (q) => {
    const ok = (text) =>
      safe(() => {
        const val = tableRow(q, 'val');
        const lft = tableRow(q, 'lft');
        const rgt = tableRow(q, 'rgt');
        for (const x of [90, 45, 60]) run(fill(q.code.lines, text), { call: 'insert', args: [val, lft, rgt, x] });
        const got = inorder(val, lft, rgt);
        return same(got, [...val].sort((a, b) => a - b));
      });
    return pickBy(q, ok);
  },

  'b-algo-0058': (q) => {
    const r = run(q.code.lines, { call: 'walk', args: [tableRow(q, 'val'), tableRow(q, 'lft'), tableRow(q, 'rgt'), 1] });
    return pick(q, r.output[2]);
  },

  'b-algo-0059': (q) => {
    const adj = q.table.rows.map((r) => r.slice(1).map(Number));
    return pick(q, run(q.code.lines, { call: 'hub', args: [adj] }).value);
  },

  'b-algo-0060': (q) => {
    const keys = [12, 27, 7, 30, 42, 15, 22];
    const lines = [...q.code.lines, '○整数型: drive()', ...keys.map((v) => `  add(${v})`), '  return search(27)'];
    checkTrace(q, lines, { call: 'drive' });
    return pick(q, run(lines, { call: 'drive' }).value);
  },
};
