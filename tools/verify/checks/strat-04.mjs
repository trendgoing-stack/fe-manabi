import { pick } from '../lib/pick.mjs';

export const checks = {
  // 発注点＝1日の平均使用量×調達期間＋安全在庫（1回の発注量は使わない）
  'a-strat-0090': (q) => pick(q, 25 * 8 + 50),
  // EOQで発注したときの年間発注費用＋年間保管費用
  'a-strat-0091': (q) => {
    const D = 5000, S = 2500, H = 100;
    const eoq = Math.sqrt((2 * D * S) / H);
    return pick(q, (D / eoq) * S + (eoq / 2) * H);
  },
  // リフト値＝P(Y|X)÷P(Y)
  'a-strat-0092': (q) => pick(q, (90 / 200) / (300 / 1000)),
};
