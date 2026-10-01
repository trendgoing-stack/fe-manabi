import { pick, pickBy } from '../lib/pick.mjs';

// ---- 図データを読むヘルパー ----

// tree 図の節を {k, l, r} の2分木に変換する（children[0] が左、children[1] が右）
const toBin = (n) => (n ? { k: n.label, l: toBin(n.children?.[0] ?? null), r: toBin(n.children?.[1] ?? null) } : null);

// tree 図の値を、根から段ごとに左から右へ並べる
const levelOrder = (root) => {
  const out = [];
  const queue = [root];
  while (queue.length) {
    const n = queue.shift();
    if (!n) continue;
    out.push(n.label);
    for (const c of n.children ?? []) queue.push(c);
  }
  return out;
};

// state 図の有限オートマトンが文字列 s を受理するか（label は「0」や「a,b」の形）
const accepts = (fig, s) => {
  let cur = fig.states.find((st) => st.initial).id;
  for (const ch of s) {
    const t = fig.transitions.filter((tr) => tr.from === cur && tr.label.split(/[,、]\s*/).includes(ch));
    if (t.length !== 1) throw new Error(`状態 ${cur} で ${ch} の遷移が ${t.length} 本`);
    cur = t[0].to;
  }
  return fig.states.find((st) => st.id === cur).final === true;
};

// logic 図の回路を評価し、最初の出力の値（0/1）を返す
const OPS = {
  AND: (v) => v.every(Boolean),
  OR: (v) => v.some(Boolean),
  NOT: (v) => !v[0],
  NAND: (v) => !v.every(Boolean),
  NOR: (v) => !v.some(Boolean),
  XOR: (v) => v.filter(Boolean).length % 2 === 1,
};
const evalCircuit = (fig, inputs) => {
  const gates = new Map(fig.gates.map((g) => [g.id, g]));
  const val = (id) => {
    if (id in inputs) return Boolean(inputs[id]);
    const g = gates.get(id);
    if (!g) throw new Error(`未定義の id ${id}`);
    return OPS[g.op](g.in.map(val));
  };
  return val(fig.outputs[0].from) ? 1 : 0;
};

export const checks = {
  // 4ビット固定小数点で 0.3 を切り捨てたときの誤差
  'a-tech-0135': (q) => {
    const v = 0.3;
    return pick(q, v - Math.floor(v * 2 ** 4) / 2 ** 4);
  },

  // 4で割り切れて6で割り切れない数
  'a-tech-0136': (q) => {
    let n = 0;
    for (let i = 1; i <= 200; i++) if (i % 4 === 0 && i % 6 !== 0) n++;
    return pick(q, n);
  },

  // ベイズの定理
  'a-tech-0137': (q) => {
    const l1 = 0.6 * 0.02, l2 = 0.4 * 0.05;
    return pick(q, Number((l2 / (l1 + l2)).toFixed(3)));
  },

  // 8ビット浮動小数点形式の最大値（全パターンを列挙）
  'a-tech-0139': (q) => {
    let max = -Infinity;
    for (let s = 0; s < 2; s++)
      for (let e = 0; e < 8; e++)
        for (let m = 0; m < 16; m++) max = Math.max(max, (-1) ** s * (1 + m / 16) * 2 ** (e - 3));
    return pick(q, max);
  },

  // 1ビット誤りの訂正（全ビットを1つずつ反転して検査式を満たすものを探す）
  'a-tech-0140': (q) => {
    const recv = q.stem.join('').match(/受信した符号は (\d{7})/)[1].split('').map(Number);
    // 位置：d1 d2 d3 d4 c1 c2 c3 → 0..6
    const eqs = [[1, 2, 3, 4], [0, 2, 3, 5], [0, 1, 3, 6]];
    const ok = (b) => eqs.every((e) => e.reduce((x, i) => x ^ b[i], 0) === 0);
    if (ok(recv)) throw new Error('受信値に誤りがない');
    const found = [];
    for (let i = 0; i < 7; i++) {
      const b = [...recv];
      b[i] ^= 1;
      if (ok(b)) found.push(b.slice(0, 4).join(''));
    }
    if (found.length !== 1) throw new Error('訂正候補が一意でない');
    return pick(q, found[0]);
  },

  // 正規表現（記法は JavaScript の正規表現と同じ意味）
  'a-tech-0141': (q) => {
    const pat = q.stem.join('').match(/パターン (\S+) に当てはまる/)[1];
    const re = new RegExp(`^${pat}$`);
    return pickBy(q, (t) => re.test(t));
  },

  // 音声データ量
  'a-tech-0143': (q) => pick(q, (16000 * 12 * 5 * 60) / 8 / 1e6),

  // 上位4ビットだけを反転するマスク演算
  'a-tech-0144': (q) => {
    const want = (x) => ((~x) & 0xf0) | (x & 0x0f);
    const ops = { AND: (a, b) => a & b, OR: (a, b) => a | b, XOR: (a, b) => a ^ b };
    return pickBy(q, (t) => {
      const [, op, hex] = t.match(/^x (AND|OR|XOR) ([0-9A-F]{2})$/);
      const m = parseInt(hex, 16);
      for (let x = 0; x < 256; x++) if (ops[op](x, m) !== want(x)) return false;
      return true;
    });
  },

  // 状態遷移図（図）が受理する文字列
  'a-tech-0145': (q) => pickBy(q, (t) => accepts(q.figure, t)),

  // 長さ4で受理される文字列の個数（図から全列挙）
  'a-tech-0146': (q) => {
    const alphabet = [...new Set(q.figure.transitions.flatMap((t) => t.label.split(/[,、]\s*/)))];
    let strs = [''];
    for (let i = 0; i < 4; i++) strs = strs.flatMap((s) => alphabet.map((c) => s + c));
    return pick(q, strs.filter((s) => accepts(q.figure, s)).length);
  },

  // 論理回路（図）の出力が1になる入力
  'a-tech-0147': (q) =>
    pickBy(q, (t) => {
      const [, A, B, C] = t.match(/A=(\d)、B=(\d)、C=(\d)/).map(Number);
      return evalCircuit(q.figure, { A, B, C }) === 1;
    }),

  // 論理回路（図）と同じ真理値表の演算
  'a-tech-0148': (q) => {
    const fn = { AND: (a, b) => a & b, OR: (a, b) => a | b, XOR: (a, b) => a ^ b, XNOR: (a, b) => 1 - (a ^ b) };
    return pickBy(q, (t) => {
      const f = fn[t.match(/（(\w+)）/)[1]];
      return [[0, 0], [0, 1], [1, 0], [1, 1]].every(([A, B]) => evalCircuit(q.figure, { A, B }) === f(A, B));
    });
  },

  // 2分探索木（図）への挿入位置
  'a-tech-0149': (q) => {
    const key = 38;
    let n = toBin(q.figure.root);
    for (;;) {
      const side = key < Number(n.k) ? 'l' : 'r';
      if (!n[side]) return pick(q, `節${n.k}の${side === 'l' ? '左' : '右'}の子`);
      n = n[side];
    }
  },

  // 最大ヒープ（図）から根を取り出した後の並び
  'a-tech-0150': (q) => {
    const h = levelOrder(q.figure.root).map(Number);
    for (let i = 1; i < h.length; i++) if (h[Math.floor((i - 1) / 2)] < h[i]) throw new Error('図がヒープでない');
    h[0] = h.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let c = l;
      if (l >= h.length) break;
      if (r < h.length && h[r] > h[l]) c = r;
      if (h[c] <= h[i]) break;
      [h[c], h[i]] = [h[i], h[c]];
      i = c;
    }
    return pick(q, h.join(', '));
  },

  // 算術式の2分木（図）を評価
  'a-tech-0151': (q) => {
    const ops = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
    const ev = (n) => (n.children ? ops[n.label](ev(n.children[0]), ev(n.children[1])) : Number(n.label));
    return pick(q, ev(q.figure.root));
  },

  // 括弧照合でのスタックの最大の深さ
  'a-tech-0152': (q) => {
    const s = q.stem.join('').match(/文字列 (\S+) を/)[1];
    const pair = { ')': '(', ']': '[', '}': '{' };
    const st = [];
    let max = 0;
    for (const ch of s) {
      if ('([{'.includes(ch)) {
        st.push(ch);
        max = Math.max(max, st.length);
      } else if (st.pop() !== pair[ch]) throw new Error('括弧が対応していない');
    }
    if (st.length) throw new Error('括弧が残った');
    return pick(q, max);
  },

  // 循環バッファのキュー
  'a-tech-0153': (q) => {
    const N = 8;
    let head = 6, tail = 6, size = 0;
    const add = (k) => { for (let i = 0; i < k; i++) { if (size === N) throw new Error('満杯'); tail = (tail + 1) % N; size++; } };
    const del = (k) => { for (let i = 0; i < k; i++) { if (size === 0) throw new Error('空'); head = (head + 1) % N; size--; } };
    add(5); del(2); add(2);
    return pick(q, tail);
  },

  // 配列で表したリストから要素を取り除く
  'a-tech-0154': (q) => {
    const next = new Map(q.table.rows.map(([p, , n]) => [Number(p), Number(n)]));
    const val = new Map(q.table.rows.map(([p, v]) => [Number(p), v]));
    let prev = 0, cur = 3;
    while (val.get(cur) !== 'M') { prev = cur; cur = next.get(cur); }
    if (prev === 0) throw new Error('M が先頭');
    return pick(q, `位置${prev}の次の位置を${next.get(cur)}にする`);
  },

  // 2分探索の最大比較回数（全要素を探して確かめる）
  'a-tech-0155': (q) => {
    const n = 2000;
    let worst = 0;
    for (let target = 0; target < n; target++) {
      let lo = 0, hi = n - 1, c = 0;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        c++;
        if (mid === target) break;
        if (target < mid) hi = mid - 1; else lo = mid + 1;
      }
      worst = Math.max(worst, c);
    }
    return pick(q, worst);
  },

  // チェイン法で最も多くのキーが入る位置
  'a-tech-0156': (q) => {
    const cnt = Array(7).fill(0);
    for (const k of [8, 25, 70, 39, 22, 33, 46]) cnt[k % 7]++;
    const max = Math.max(...cnt);
    if (cnt.filter((c) => c === max).length !== 1) throw new Error('最多の位置が一意でない');
    return pick(q, cnt.indexOf(max));
  },

  // 選択ソートの交換回数
  'a-tech-0157': (q) => {
    const a = [7, 3, 9, 1, 5];
    let swaps = 0;
    for (let i = 0; i < a.length - 1; i++) {
      let m = i;
      for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j;
      if (m !== i) { [a[i], a[m]] = [a[m], a[i]]; swaps++; }
    }
    return pick(q, swaps);
  },

  // マージの比較回数
  'a-tech-0158': (q) => {
    const x = [2, 9, 14], y = [5, 6, 20];
    let i = 0, j = 0, c = 0;
    while (i < x.length && j < y.length) {
      c++;
      if (x[i] <= y[j]) i++; else j++;
    }
    return pick(q, c);
  },

  // 再帰（互除法）の呼出し回数
  'a-tech-0159': (q) => {
    let calls = 0;
    const g = (m, n) => { calls++; return n === 0 ? m : g(n, m % n); };
    g(399, 156);
    return pick(q, calls);
  },

  // ダイクストラ法（表から）
  'a-tech-0160': (q) => {
    const adj = new Map();
    const link = (a, b, w) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, w]); };
    for (const [a, b, w] of q.table.rows) { link(a, b, Number(w)); link(b, a, Number(w)); }
    const dist = new Map([...adj.keys()].map((v) => [v, Infinity]));
    dist.set('A', 0);
    const done = new Set();
    while (done.size < adj.size) {
      const [u] = [...dist].filter(([v]) => !done.has(v)).sort((p, r) => p[1] - r[1])[0];
      done.add(u);
      for (const [v, w] of adj.get(u)) if (dist.get(u) + w < dist.get(v)) dist.set(v, dist.get(u) + w);
    }
    return pick(q, dist.get('F'));
  },
};
