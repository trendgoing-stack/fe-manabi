// 実行検証用のヘルパー（開発用・Node）。公開物ではない。

const norm = (s) => String(s).normalize('NFKC').replace(/[\s,，]/g, '').replace(/[−‐–]/g, '-');

/** 数値として読める文字列なら数値を返す。単位などが付いていれば NaN */
const asNumber = (s) => {
  const t = norm(s);
  if (/^-?\d+\/\d+$/.test(t)) {
    const [a, b] = t.split('/').map(Number);
    return a / b;
  }
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
};

/** 先頭の数値だけを取り出す（「12.5ミリ秒」→ 12.5） */
const leadingNumber = (s) => {
  const m = norm(s).match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

/**
 * value に一致する選択肢の index を返す。ちょうど1つでなければ例外。
 * 比較順：文字列の完全一致 → 数値の一致 → 先頭の数値の一致（単位付き）
 * @param {{id:string, choices:{text:string}[]}} q
 * @param {string|number} value
 */
export function pick(q, value) {
  const texts = q.choices.map((c) => c.text);
  const target = norm(value);
  const num = typeof value === 'number' ? value : asNumber(value);
  const eq = (a, b) => Math.abs(a - b) < 1e-9;
  const passes = [
    (t) => norm(t) === target,
    (t) => !Number.isNaN(num) && eq(asNumber(t), num),
    (t) => !Number.isNaN(num) && eq(leadingNumber(t), num),
  ];
  for (const test of passes) {
    const hits = texts.map((t, i) => (test(t) ? i : -1)).filter((i) => i >= 0);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) throw new Error(`${q.id}: 「${value}」に一致する選択肢が複数ある`);
  }
  throw new Error(`${q.id}: 「${value}」に一致する選択肢がない（${texts.join(' / ')}）`);
}

/** 条件に合う選択肢がちょうど1つのとき、その index を返す */
export function pickBy(q, predicate) {
  const hits = q.choices.map((c, i) => (predicate(c.text, i) ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) throw new Error(`${q.id}: 条件に合う選択肢が ${hits.length} 個`);
  return hits[0];
}
