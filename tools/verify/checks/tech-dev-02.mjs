import { pick, pickBy } from '../lib/pick.mjs';

/** 「(8, 6), (3, 4)」の形の文字列から入力の組を取り出す */
const parsePairs = (text) =>
  [...text.matchAll(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g)].map((m) => [Number(m[1]), Number(m[2])]);

/** 表の数字（全角・桁区切りを含む）を数値にする */
const num = (s) => Number(String(s).normalize('NFKC').replace(/,/g, ''));

export const checks = {
  // 判定条件網羅：二つの判定がそれぞれ真と偽の両方を通る組合せを探す
  'a-tech-0129': (q) =>
    pickBy(q, (text) => {
      const seen = [new Set(), new Set()];
      for (const [x, y0] of parsePairs(text)) {
        const d1 = x > 5;
        const y = d1 ? y0 + 3 : y0 - 3;
        const d2 = y > x;
        seen[0].add(d1);
        seen[1].add(d2);
      }
      return seen.every((s) => s.size === 2);
    }),

  // デシジョンテーブル：注文ごとに一致する規則を探し、送料を合計する
  'a-tech-0131': (q) => {
    const rows = q.table.rows;
    const row = (key) => {
      const r = rows.find((x) => x[0].includes(key));
      if (!r) throw new Error(`${q.id}: 行「${key}」が表にない`);
      return r;
    };
    const member = row('会員である');
    const amountRow = row('以上である');
    const feeRow = row('請求する');
    const threshold = num(amountRow[0].normalize('NFKC').match(/([\d,]+)円以上/)[1]);
    const fee = num(feeRow[0].normalize('NFKC').match(/送料([\d,]+)円/)[1]);

    // 問題文の「注文n：会員／非会員、購入額x円」を読み取る
    const orders = [...q.stem.join('').normalize('NFKC').matchAll(/注文\d+:(非?会員)、購入額([\d,]+)円/g)].map(
      (m) => ({ isMember: m[1] === '会員', amount: num(m[2]) }),
    );
    if (orders.length !== 5) throw new Error(`${q.id}: 注文を ${orders.length} 件しか読み取れない`);

    let total = 0;
    for (const o of orders) {
      const cols = [1, 2, 3, 4].filter(
        (c) => (member[c] === 'Y') === o.isMember && (amountRow[c] === 'Y') === (o.amount >= threshold),
      );
      if (cols.length !== 1) throw new Error(`${q.id}: 一致する規則が ${cols.length} 個`);
      if (feeRow[cols[0]] === 'X') total += fee;
    }
    return pick(q, total);
  },
};
