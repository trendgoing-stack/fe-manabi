import { pick } from '../lib/pick.mjs';

const toMin = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

export const checks = {
  // 同時使用ライセンス：利用時間帯の重なりの最大値
  'a-tech-0265': (q) => {
    const spans = q.table.rows.map(([, t]) => t.split('〜').map(toMin));
    const events = [];
    for (const [s, e] of spans) {
      events.push([s, 1], [e, -1]);
    }
    // 同時刻では終了を先に処理する
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0;
    let max = 0;
    for (const [, d] of events) {
      cur += d;
      max = Math.max(max, cur);
    }
    return pick(q, max);
  },
};
