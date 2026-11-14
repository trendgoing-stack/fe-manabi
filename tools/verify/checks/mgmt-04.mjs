import { pick } from '../lib/pick.mjs';

export const checks = {
  // 使用率は利用者数に比例。80%となる利用者数までの増加分を毎月の増加数で割る
  'a-mgmt-0058': (q) => {
    const users = 1200, usage = 48, perMonth = 50, threshold = 80;
    const target = (users * threshold) / usage;
    return pick(q, (target - users) / perMonth);
  },
  // 合意サービス時間＝提供時間−計画停止。停止時間は障害分だけ
  'a-mgmt-0061': (q) => {
    const provided = (21 - 9) * 30;
    const agreed = provided - 10;
    const down = 1 + 45 / 60;
    return pick(q, (((agreed - down) / agreed) * 100).toFixed(2));
  },
};
