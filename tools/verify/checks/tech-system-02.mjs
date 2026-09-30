import { pick } from '../lib/pick.mjs';

const sum = (xs) => xs.reduce((s, x) => s + x, 0);

/** パイプラインで命令を1本ずつ流し、最後の命令が最終ステージを抜ける時刻を求める */
function pipelineTime(stages, instructions, stageTime) {
  let lastFinish = 0;
  for (let i = 0; i < instructions; i++) {
    const start = i * stageTime; // 1ステージ分ずつ遅れて投入される
    lastFinish = start + stages * stageTime;
  }
  return lastFinish;
}

/** 問題の表（番地, 内容）から主記憶を作る */
const memoryOf = (q) => new Map(q.table.rows.map(([addr, value]) => [Number(addr), Number(value)]));

/** Dフリップフロップ3個の帰還付きシフトレジスタを clocks 回動かす */
function shiftRegister(state, clocks) {
  let [q1, q2, q3] = state;
  for (let i = 0; i < clocks; i++) {
    [q1, q2, q3] = [q2 ^ q3, q1, q2];
  }
  return `${q1}${q2}${q3}`;
}

/** n台のうちk台以上が動作する確率（各装置の稼働率は a）を全状態の列挙で求める */
function kOutOfN(k, n, a) {
  let total = 0;
  for (let bits = 0; bits < 1 << n; bits++) {
    let up = 0;
    let p = 1;
    for (let i = 0; i < n; i++) {
      const alive = (bits >> i) & 1;
      up += alive;
      p *= alive ? a : 1 - a;
    }
    if (up >= k) total += p;
  }
  return total;
}

/** 差分バックアップ：直近のフルバックアップ以降に作られた全データを毎回取得する */
function differentialTotal(dailyNew, days) {
  let sinceFull = 0;
  let total = 0;
  for (let d = 0; d < days; d++) {
    sinceFull += dailyNew;
    total += sinceFull;
  }
  return total;
}

/** 最良適合方式で要求を順に割り当て、割当て後の空き領域の並びを返す */
function bestFit(free, requests) {
  const areas = [...free];
  for (const size of requests) {
    let best = -1;
    for (let i = 0; i < areas.length; i++) {
      if (areas[i] >= size && (best < 0 || areas[i] < areas[best])) best = i;
    }
    if (best < 0) throw new Error(`割り当てられない要求がある（${size}）`);
    areas[best] -= size;
  }
  return areas;
}

/** 重み付き合計を10で割った余りを10から引く（余り0のときは0）チェックディジット */
function checkDigit(digits, weights) {
  const r = sum(digits.map((d, i) => d * weights[i])) % 10;
  return r === 0 ? 0 : 10 - r;
}

export const checks = {
  // (ステージ数 + 命令数 − 1) × 1ステージの時間 になることをシミュレーションで求める
  'a-tech-0087': (q) => pick(q, pipelineTime(5, 20, 2)),

  // 指標アドレス指定：実効アドレス = アドレス部 + 指標レジスタ、その番地の内容がオペランド
  'a-tech-0088': (q) => {
    const mem = memoryOf(q);
    const operand = mem.get(120 + 30);
    if (operand === undefined) throw new Error('a-tech-0088: 実効アドレスの番地が表にない');
    return pick(q, operand);
  },

  // 256Mバイトをバイト単位で指定するのに必要な最小ビット数
  'a-tech-0089': (q) => {
    const bytes = 256 * 2 ** 20;
    let bits = 0;
    while (2 ** bits < bytes) bits += 1;
    return pick(q, bits);
  },

  // 帰還付きシフトレジスタを5クロック分動かす
  'a-tech-0092': (q) => pick(q, shiftRegister([1, 0, 0], 5)),

  // 入力電圧 ÷ 刻み幅（ミリボルトで計算）の商
  'a-tech-0093': (q) => {
    const stepMv = 5120 / 2 ** 8;
    return pick(q, Math.floor(3200 / stepMv));
  },

  // 3台中2台以上が動作する確率
  'a-tech-0096': (q) => pick(q, kOutOfN(2, 3, 0.9).toFixed(3)),

  // M/M/1：平均待ち時間 = ρ/(1−ρ)×平均サービス時間、平均応答時間はそれに平均サービス時間を足す
  'a-tech-0097': (q) => {
    const service = 2; // 分
    const rho = (24 / 60) * service;
    const wait = (rho / (1 - rho)) * service;
    return pick(q, (wait + service).toFixed(1));
  },

  // 差分バックアップ6回分の合計
  'a-tech-0100': (q) => pick(q, differentialTotal(10, 6)),

  // 最良適合方式で割り当てた後の最大の空き領域
  'a-tech-0101': (q) => pick(q, Math.max(...bestFit([40, 15, 60, 25], [20, 50, 12, 10]))),

  // チェックディジット
  'a-tech-0105': (q) => pick(q, checkDigit([6, 3, 8, 4], [5, 4, 3, 2])),

  // 画素数 × 1画素のバイト数 × フレームレート × 秒数
  'a-tech-0106': (q) => pick(q, (800 * 600 * (24 / 8) * 30 * 10) / 1e6),
};
