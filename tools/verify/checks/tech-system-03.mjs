import { pick, pickBy } from '../lib/pick.mjs';

const sum = (xs) => xs.reduce((s, x) => s + x, 0);

/** 2ブロックのLRUキャッシュ（ライトバック、書込み時も読み込む）で、表の操作による書き戻し回数を数える */
function writeBacks(rows, capacity) {
  let cache = []; // 先頭が最も長く参照されていないブロック { block, dirty }
  let count = 0;
  for (const [, op, block] of rows) {
    let i = cache.findIndex((e) => e.block === block);
    let entry;
    if (i >= 0) {
      [entry] = cache.splice(i, 1);
    } else {
      if (cache.length === capacity) {
        const victim = cache.shift();
        if (victim.dirty) count += 1;
      }
      entry = { block, dirty: false };
    }
    if (op === '書込み') entry.dirty = true;
    cache.push(entry);
  }
  return count;
}

const OPS = {
  AND: (v) => v.every(Boolean) ? 1 : 0,
  OR: (v) => v.some(Boolean) ? 1 : 0,
  NOT: (v) => (v[0] ? 0 : 1),
  NAND: (v) => (v.every(Boolean) ? 0 : 1),
  NOR: (v) => (v.some(Boolean) ? 0 : 1),
  XOR: (v) => v.reduce((a, b) => a ^ b, 0),
};

/** 図の論理回路を、入力値 { id: 0|1 } で評価し、出力 { id: 0|1 } を返す */
function evalLogic(fig, inputs) {
  // 同じラベルの入力端子（例：A と A2 がどちらも「A」）には同じ値を入れる
  const val = Object.fromEntries(fig.inputs.map((i) => [i.id, inputs[i.label]]));
  const gates = new Map(fig.gates.map((g) => [g.id, g]));
  const get = (id) => {
    if (id in val) return val[id];
    const g = gates.get(id);
    if (!g) throw new Error(`論理回路に ${id} がない`);
    val[id] = OPS[g.op](g.in.map(get));
    return val[id];
  };
  return Object.fromEntries(fig.outputs.map((o) => [o.id, get(o.from)]));
}

/** 状態遷移図を操作列に従ってたどる（矢印がない操作は無視） */
function traceState(fig, events) {
  let cur = fig.states.find((s) => s.initial).id;
  for (const e of events) {
    const t = fig.transitions.find((tr) => tr.from === cur && tr.label === e);
    if (t) cur = t.to;
  }
  return fig.states.find((s) => s.id === cur).label;
}

/** ノンプリエンプティブなSJFの実行結果（開始時刻）を求める */
function sjf(procs) {
  const done = new Map();
  let t = 0;
  const rest = [...procs];
  while (rest.length) {
    const ready = rest.filter((p) => p.arrival <= t);
    if (!ready.length) { t = Math.min(...rest.map((p) => p.arrival)); continue; }
    ready.sort((a, b) => a.cpu - b.cpu || a.arrival - b.arrival);
    const p = ready[0];
    done.set(p.name, t);
    t += p.cpu;
    rest.splice(rest.indexOf(p), 1);
  }
  return done;
}

/**
 * CPU1台・入出力装置1台で複数ジョブを1ミリ秒刻みで実行し、全ジョブの終了時刻を返す。
 * CPUは priority の順で優先し非プリエンプティブ。入出力は要求順（同時なら priority 順）。
 */
function multiprogram(jobs, priority, ioShared = false) {
  const st = jobs.map((j) => ({ ...j, idx: 0, left: j.phases[0].len, running: false, reqAt: 0 }));
  let t = 0;
  let cpu = null;
  let io = null;
  const ioUsers = new Set();
  const finished = () => st.every((s) => s.idx >= s.phases.length);
  const order = (a, b) => priority.indexOf(a.name) - priority.indexOf(b.name);
  while (!finished()) {
    if (cpu === null) {
      const c = st.filter((s) => s.idx < s.phases.length && s.phases[s.idx].kind === 'cpu').sort(order)[0];
      if (c) { cpu = c; c.running = true; }
    }
    const ioWait = st
      .filter((s) => s.idx < s.phases.length && s.phases[s.idx].kind === 'io' && !s.running)
      .sort((a, b) => a.reqAt - b.reqAt || order(a, b));
    for (const s of ioWait) {
      if (ioShared) { s.running = true; ioUsers.add(s); } else if (io === null) { io = s; s.running = true; }
    }
    t += 1;
    for (const s of st) {
      if (!s.running) continue;
      s.left -= 1;
      if (s.left === 0) {
        s.running = false;
        if (cpu === s) cpu = null;
        if (io === s) io = null;
        ioUsers.delete(s);
        s.idx += 1;
        if (s.idx < s.phases.length) { s.left = s.phases[s.idx].len; s.reqAt = t; }
      }
    }
    if (t > 1000) throw new Error('シミュレーションが終わらない');
  }
  return t;
}

/** ガント図のタスク（「X CPU①」「X 入出力」…）からジョブごとの処理の並びを作る */
function jobsFromGantt(fig) {
  const byJob = new Map();
  for (const task of [...fig.tasks].sort((a, b) => a.start - b.start)) {
    const [name, kindLabel] = task.label.split(' ');
    const kind = kindLabel.startsWith('CPU') ? 'cpu' : 'io';
    if (!byJob.has(name)) byJob.set(name, []);
    byJob.get(name).push({ kind, len: task.length });
  }
  return [...byJob].map(([name, phases]) => ({ name, phases }));
}

function fifoFaults(refs, frames) {
  const f = [];
  let c = 0;
  for (const r of refs) {
    if (f.includes(r)) continue;
    c += 1;
    if (f.length === frames) f.shift();
    f.push(r);
  }
  return c;
}

export const checks = {
  // LRU・ライトバックのキャッシュを表のとおりに動かし、書き戻し回数を数える
  'a-tech-0165': (q) => pick(q, writeBacks(q.table.rows, 2)),

  // 1回の転送のバイト数 × 転送回数
  'a-tech-0167': (q) => pick(q, ((64 / 8) * 2400e6 / 1e9).toFixed(1)),

  // アムダールの法則：100 ÷ (直列部分 + 並列部分 ÷ コア数)
  'a-tech-0168': (q) => pick(q, (100 / (20 + 80 / 4)).toFixed(1)),

  // 図の回路を A=1, B=0, C=1 で評価する
  'a-tech-0169': (q) => {
    const out = evalLogic(q.figure, { A: 1, B: 0, C: 1 });
    return pick(q, `S=${out.S}、Co=${out.Co}`);
  },

  // 図の回路を8通りの入力で評価し、X=1 の個数を数える
  'a-tech-0170': (q) => {
    let n = 0;
    for (let b = 0; b < 8; b++) {
      const out = evalLogic(q.figure, { A: (b >> 2) & 1, B: (b >> 1) & 1, C: b & 1 });
      n += out.X;
    }
    return pick(q, n);
  },

  // 図の状態遷移を操作列でたどる
  'a-tech-0171': (q) => {
    const last = traceState(q.figure, ['段', '段', '入', '段', '切', '入', '段', '段']);
    return pickBy(q, (t) => t === last);
  },

  // RAID5：(台数 − 1) × 1台の容量
  // RAID5 で実効容量14Tバイト以上を確保する最少台数（1台分はパリティ）
  'a-tech-0173': (q) => {
    let n = 3;
    while (2 * (n - 1) < 14) n++;
    return pick(q, n);
  },

  // 稼働率 = MTBF ÷ (MTBF + MTTR)
  'a-tech-0174': (q) => pick(q, (380 / (380 + 20)).toFixed(3)),

  // TCO = 初期費用 + 年間運用費 × 年数
  'a-tech-0176': (q) => pick(q, 400 + 200 + (80 + 70) * 4),

  // 直列システムの故障率は各装置の故障率の和、MTBFはその逆数
  'a-tech-0177': (q) => {
    const rate = sum([600, 300, 200].map((m) => 1 / m));
    return pick(q, Math.round(1 / rate));
  },

  // 図の実行結果がSJFのシミュレーションと一致することを確かめ、図から平均ターンアラウンドタイムを求める
  'a-tech-0178': (q) => {
    const procs = q.table.rows.map(([name, arrival, cpu]) => ({ name, arrival: Number(arrival), cpu: Number(cpu) }));
    const starts = sjf(procs);
    for (const task of q.figure.tasks) {
      const p = procs.find((x) => x.name === task.label);
      if (starts.get(task.label) !== task.start || p.cpu !== task.length) {
        throw new Error(`a-tech-0178: 図の ${task.label} がSJFの結果と一致しない`);
      }
    }
    const tat = q.figure.tasks.map((task) => task.start + task.length - procs.find((x) => x.name === task.label).arrival);
    return pick(q, sum(tat) / tat.length);
  },

  // 図から各ジョブの処理の並びを読み、X優先で多重実行したときの終了時刻を求める
  'a-tech-0179': (q) => {
    const jobs = jobsFromGantt(q.figure);
    return pick(q, multiprogram(jobs, ['X', 'Y']));
  },

  // FIFO方式のページフォールト回数
  'a-tech-0180': (q) => {
    const refs = q.stem[1].split(',').map((s) => Number(s.trim()));
    return pick(q, fifoFaults(refs, 3));
  },

  // 画素数 × 3バイト ÷ 8（Mバイト）
  'a-tech-0186': (q) => pick(q, ((6 * 300) * (4 * 300) * 3 / 8 / 1e6).toFixed(2)),
};

