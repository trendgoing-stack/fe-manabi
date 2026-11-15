import { pick } from '../lib/pick.mjs';

export const checks = {
  // 従量制 1,500＋300x 円 と 月額固定 7,500円 が等しくなる通信量
  'a-tech-0287': (q) => pick(q, (7500 - 1500) / 300),
  // 偶数パリティ：1の個数が奇数の受信符号だけが誤りと判定される
  'a-tech-0290': (q) => {
    const hits = q.choices
      .map((c, i) => ([...c.text].filter((b) => b === '1').length % 2 === 1 ? i : -1))
      .filter((i) => i >= 0);
    if (hits.length !== 1) throw new Error(`${q.id}: 誤りと判定される選択肢が ${hits.length} 個`);
    return hits[0];
  },
  // A→衛星→B→衛星→A の4区間を電波が進む時間（秒）
  'a-tech-0294': (q) => pick(q, ((36000 * 4) / 300000).toFixed(2)),
  // 二分岐の判定：while 1、if 1、3方向の switch は 3−1＝2。複雑度＝判定数＋1
  'a-tech-0304': (q) => pick(q, 1 + 1 + (3 - 1) + 1),
};
