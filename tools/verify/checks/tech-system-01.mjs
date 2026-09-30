import { pick, pickBy } from '../lib/pick.mjs';

const nand = (a, b) => (a && b ? 0 : 1);

/** 2入力の論理関数の真理値表を文字列にする */
const truthTable = (f) =>
  [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => f(a, b)).join('');

/** ラウンドロビン方式で各プロセスの終了時刻を求める（全プロセスが時刻0に到着） */
function roundRobin(bursts, quantum) {
  const queue = bursts.map((remain, id) => ({ id, remain }));
  const finish = new Array(bursts.length).fill(0);
  let now = 0;
  while (queue.length > 0) {
    const p = queue.shift();
    const run = Math.min(quantum, p.remain);
    now += run;
    p.remain -= run;
    if (p.remain > 0) queue.push(p);
    else finish[p.id] = now;
  }
  return finish;
}

/** LRU方式でのページフォールト回数 */
function lruFaults(refs, frames) {
  const mem = []; // 先頭が最も長く参照されていないページ
  let faults = 0;
  for (const page of refs) {
    const at = mem.indexOf(page);
    if (at >= 0) {
      mem.splice(at, 1);
    } else {
      faults += 1;
      if (mem.length === frames) mem.shift();
    }
    mem.push(page);
  }
  return faults;
}

/**
 * 二つのタスクの資源獲得順序から、デッドロックに到達し得るかを状態探索で調べる。
 * 各タスクは資源を順に獲得し、すべて獲得した時点で処理を終えて全資源を解放する。
 */
function canDeadlock(seq1, seq2) {
  const seqs = [seq1, seq2];
  const seen = new Set();
  const stack = [[0, 0]]; // 各タスクが獲得済みの資源数（seq.length で終了・解放済み）
  while (stack.length > 0) {
    const state = stack.pop();
    const key = state.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const done = (t) => state[t] === seqs[t].length;
    const held = (t) => (done(t) ? [] : seqs[t].slice(0, state[t]));
    const nexts = [];
    for (const t of [0, 1]) {
      if (done(t)) continue;
      const want = seqs[t][state[t]];
      if (held(1 - t).includes(want)) continue; // 相手が保持中なので待つ
      const next = [...state];
      next[t] += 1;
      nexts.push(next);
    }
    if (nexts.length === 0 && !(done(0) && done(1))) return true;
    stack.push(...nexts);
  }
  return false;
}

/** カレントディレクトリと相対パスから絶対パスを求める */
function resolvePath(cwd, rel) {
  const parts = cwd.split('/').filter(Boolean);
  for (const seg of rel.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return '/' + parts.join('/');
}

/** ランレングス法（文字1バイト＋個数1バイト）で符号化した後のバイト数 */
function runLengthBytes(data) {
  let runs = 0;
  for (let i = 0; i < data.length; i++) {
    if (i === 0 || data[i] !== data[i - 1]) runs += 1;
  }
  return runs * 2;
}

export const checks = {
  // 平均クロック数から MIPS を求める
  'a-tech-0019': (q) => {
    const mix = [[4, 0.6], [8, 0.3], [12, 0.1]];
    const avgClocks = mix.reduce((s, [clk, rate]) => s + clk * rate, 0);
    return pick(q, Math.round(2.4e9 / avgClocks / 1e6));
  },

  // 実効アクセス時間 = cache×h + main×(1−h) を h について解く
  'a-tech-0020': (q) => {
    const cache = 10, main = 90, effective = 18;
    return pick(q, ((main - effective) / (main - cache)).toFixed(2));
  },

  // NAND 3個の回路の真理値表と、選択肢の論理演算の真理値表を比べる
  'a-tech-0024': (q) => {
    const circuit = truthTable((a, b) => nand(nand(a, a), nand(b, b)));
    const ops = {
      AND: (a, b) => a & b,
      OR: (a, b) => a | b,
      XOR: (a, b) => a ^ b,
      NOR: (a, b) => 1 - (a | b),
      NAND: (a, b) => 1 - (a & b),
    };
    return pickBy(q, (text) => {
      const m = text.normalize('NFKC').match(/\(([A-Z]+)\)/);
      if (!m || !ops[m[1]]) throw new Error(`a-tech-0024: 演算名を読み取れない（${text}）`);
      return truthTable(ops[m[1]]) === circuit;
    });
  },

  // 位置決め + 回転待ち（半回転）+ データ転送
  'a-tech-0025': (q) => {
    const rotation = 60000 / 7500; // 1回転のミリ秒
    const seek = 9;
    const transfer = rotation * (100 / 400);
    return pick(q, Math.round((seek + rotation / 2 + transfer) * 1000) / 1000);
  },

  // Web 2台並列 × DB 1台直列
  'a-tech-0026': (q) => pick(q, ((1 - (1 - 0.9) ** 2) * 0.95).toFixed(4)),

  // MTBF = 稼働時間の合計 ÷ 故障回数
  'a-tech-0027': (q) => {
    const repairs = [5, 7, 3, 9];
    const up = 600 - repairs.reduce((s, x) => s + x, 0);
    return pick(q, up / repairs.length);
  },

  // RAID6 はパリティに2台分を使う
  'a-tech-0028': (q) => pick(q, (6 - 2) * 4),

  // 使える命令数 ÷ 1件当たりの命令数
  'a-tech-0030': (q) => pick(q, Math.round((250e6 * 0.8) / 50e4)),

  // ラウンドロビンをシミュレーションして平均ターンアラウンドタイムを求める
  'a-tech-0031': (q) => {
    const finish = roundRobin([50, 20, 50], 20);
    return pick(q, finish.reduce((s, x) => s + x, 0) / finish.length);
  },

  // LRU をシミュレーションしてページフォールト回数を数える
  'a-tech-0032': (q) => pick(q, lruFaults([2, 5, 2, 7, 5, 1, 2, 7, 4, 5], 3)),

  // 選択肢から獲得順序を読み取り、デッドロックに到達し得るものを探す
  'a-tech-0033': (q) =>
    pickBy(q, (text) => {
      const m1 = text.match(/T1は([A-Z→]+)/);
      const m2 = text.match(/T2は([A-Z→]+)/);
      if (!m1 || !m2) throw new Error(`a-tech-0033: 獲得順序を読み取れない（${text}）`);
      return canDeadlock(m1[1].split('→'), m2[1].split('→'));
    }),

  // 相対パスを解決する
  'a-tech-0034': (q) => pick(q, resolvePath('/home/sato/work', '../../tanaka/doc/memo.txt')),

  // 標本化周波数 × バイト数 × チャネル数 × 秒数
  'a-tech-0037': (q) => pick(q, (24000 * (16 / 8) * 2 * 50) / 1e6),

  // ランレングス符号化後のバイト数
  'a-tech-0038': (q) => pick(q, runLengthBytes('WWWWBBWWWWWBBBWB')),
};
