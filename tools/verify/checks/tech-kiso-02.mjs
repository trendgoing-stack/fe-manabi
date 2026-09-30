import { pick, pickBy } from '../lib/pick.mjs';

// AND / OR / NOT で書かれた論理式を、A と B の値を与えて評価する
const evalLogic = (text, A, B) => {
  const js = text.replace(/NOT/g, '!').replace(/AND/g, '&&').replace(/OR/g, '||');
  return Boolean(new Function('A', 'B', `return (${js});`)(A, B));
};

// 中置記法（1文字の変数、+ - × ÷、括弧）を逆ポーランド記法に変換する
const toRpn = (infix) => {
  const prec = { '+': 1, '-': 1, '×': 2, '÷': 2 };
  const out = [];
  const ops = [];
  for (const ch of infix) {
    if (/[A-Z]/.test(ch)) out.push(ch);
    else if (ch === '(') ops.push(ch);
    else if (ch === ')') {
      while (ops[ops.length - 1] !== '(') out.push(ops.pop());
      ops.pop();
    } else {
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[ch]) {
        out.push(ops.pop());
      }
      ops.push(ch);
    }
  }
  while (ops.length) out.push(ops.pop());
  return out.join('');
};

// 2分探索木（挿入と、右部分木の最小値で置き換える削除）
const bstInsert = (node, k) => {
  if (!node) return { k, l: null, r: null };
  if (k < node.k) node.l = bstInsert(node.l, k);
  else node.r = bstInsert(node.r, k);
  return node;
};
const bstDelete = (node, k) => {
  if (!node) return null;
  if (k < node.k) node.l = bstDelete(node.l, k);
  else if (k > node.k) node.r = bstDelete(node.r, k);
  else {
    if (!node.l) return node.r;
    if (!node.r) return node.l;
    let min = node.r;
    while (min.l) min = min.l;
    node.k = min.k;
    node.r = bstDelete(node.r, min.k);
  }
  return node;
};
const bstFind = (node, k) => {
  while (node && node.k !== k) node = k < node.k ? node.l : node.r;
  return node;
};

// 先頭を基準値とし、順序を保って「小さい列・基準値・大きい列」に分ける
const partition = (list) => {
  const [pivot, ...rest] = list;
  return { left: rest.filter((v) => v < pivot), pivot, right: rest.filter((v) => v > pivot) };
};

export const checks = {
  // 8ビットの算術右シフト
  'a-tech-0069': (q) => {
    const signed = (parseInt('11101000', 2) << 24) >> 24; // 8ビットを符号拡張
    return pick(q, signed >> 2);
  },

  // NOT (A OR (NOT B)) と真理値表が一致する式
  'a-tech-0070': (q) => {
    const cases = [[false, false], [false, true], [true, false], [true, true]];
    return pickBy(q, (text) =>
      cases.every(([A, B]) => evalLogic(text, A, B) === evalLogic('NOT (A OR (NOT B))', A, B)));
  },

  // 標本化定理
  'a-tech-0071': (q) => pick(q, 8 * 2),

  // 分散
  'a-tech-0072': (q) => {
    const dist = [[1, 0.2], [3, 0.6], [5, 0.2]];
    const mean = dist.reduce((s, [x, p]) => s + x * p, 0);
    return pick(q, dist.reduce((s, [x, p]) => s + (x - mean) ** 2 * p, 0));
  },

  // 正規分布の片側の割合
  'a-tech-0073': (q) => {
    const mean = 500, sd = 4, within2sd = 95.4, limit = 508;
    if ((limit - mean) / sd !== 2) throw new Error('limit が 平均+2σ ではない');
    return pick(q, (100 - within2sd) / 2);
  },

  // M/M/1 の平均待ち時間
  'a-tech-0074': (q) => {
    const arrivalsPerHour = 12, serviceMin = 3;
    const rho = (arrivalsPerHour * serviceMin) / 60;
    return pick(q, (rho / (1 - rho)) * serviceMin);
  },

  // 逆ポーランド記法への変換
  'a-tech-0075': (q) => pick(q, toRpn('(A-B)×C+D÷(E-F)')),

  // 次数の合計 = 辺数 × 2
  'a-tech-0076': (q) => pick(q, [3, 3, 2, 2, 2, 1, 1].reduce((a, b) => a + b, 0) / 2),

  // 適合率（表から計算）
  'a-tech-0077': (q) => {
    const [[, tp, fp]] = q.table.rows.map((r) => r.map(Number));
    return pick(q, (tp / (tp + fp)).toFixed(2));
  },

  // 最小ヒープへの挿入（1始まりの配列）
  'a-tech-0078': (q) => {
    const heap = [null, 5, 9, 12, 14, 20, 18];
    heap.push(7);
    let i = heap.length - 1;
    while (i > 1 && heap[Math.floor(i / 2)] > heap[i]) {
      const p = Math.floor(i / 2);
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
    return pick(q, heap.slice(1).join(', '));
  },

  // 2分探索木の削除
  'a-tech-0079': (q) => {
    let root = null;
    for (const k of [40, 20, 60, 10, 30, 50, 70, 25, 35, 27]) root = bstInsert(root, k);
    root = bstDelete(root, 20);
    return pick(q, bstFind(root, 30).l.k);
  },

  // 力まかせの文字列照合の比較回数
  'a-tech-0080': (q) => {
    const text = 'AABAABAC', pat = 'ABAC';
    let count = 0;
    for (let s = 0; s + pat.length <= text.length; s++) {
      let j = 0;
      while (j < pat.length) {
        count++;
        if (text[s + j] !== pat[j]) break;
        j++;
      }
      if (j === pat.length) break;
    }
    return pick(q, count);
  },

  // クイックソート：全体を分割した後、左側の列だけをもう1回分割
  'a-tech-0081': (q) => {
    const first = partition([45, 12, 78, 30, 56, 9, 63]);
    const second = partition(first.left);
    const result = [...second.left, second.pivot, ...second.right, first.pivot, ...first.right];
    return pick(q, result.join(', '));
  },

  // 5で割った余りの合計
  'a-tech-0083': (q) => {
    let n = 193, s = 0;
    while (n > 0) {
      s += n % 5;
      n = Math.floor(n / 5);
    }
    return pick(q, s);
  },

  // 再帰関数の呼出し回数
  'a-tech-0084': (q) => {
    let calls = 0;
    const h = (n) => {
      calls++;
      return n < 2 ? 1 : h(Math.floor(n / 2)) + h(n - 2);
    };
    h(6);
    return pick(q, calls);
  },
};
