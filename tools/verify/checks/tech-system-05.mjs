import { pick } from '../lib/pick.mjs';

export const checks = {
  // ブロック化：レコードはブロックをまたがない
  'a-tech-0270': (q) => {
    const rec = 300, n = 6500, block = 4096;
    const perBlock = Math.floor(block / rec);
    return pick(q, Math.ceil(n / perBlock));
  },
  // チャネルによる読込みと CPU 処理の重ね合わせ（バッファ2つ）
  'a-tech-0271': (q) => {
    const N = 100, R = 8, P = 5, BUF = 2;
    const readEnd = [];
    const procEnd = [];
    let channelFree = 0;
    let cpuFree = 0;
    for (let i = 0; i < N; i++) {
      // バッファが空くのは、BUF 個前のブロックの処理が終わったとき
      const bufFree = i >= BUF ? procEnd[i - BUF] : 0;
      const rs = Math.max(channelFree, bufFree);
      readEnd[i] = rs + R;
      channelFree = readEnd[i];
      const ps = Math.max(readEnd[i], cpuFree);
      procEnd[i] = ps + P;
      cpuFree = procEnd[i];
    }
    return pick(q, procEnd[N - 1]);
  },
};
