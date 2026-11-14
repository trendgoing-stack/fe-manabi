import { pick } from '../lib/pick.mjs';

export const checks = {
  // 桁別コード：大分類10種 × 中分類26種 × 品目番号1,000種
  'a-tech-0245': (q) => pick(q, 10 * 26 * 10 ** 3),
  // ストリーミング：(映像5.6 + 音声0.4)Mビット/秒 × 90分 → Gバイト
  'a-tech-0247': (q) => pick(q, (((5.6 + 0.4) * 1e6 * 90 * 60) / 8 / 1e9).toFixed(2)),
  // 色数：RGB各6ビット
  'a-tech-0248': (q) => pick(q, 2 ** (6 * 3)),
  // ストアドプロシージャ：変更前 (往復20+実行5)×10、変更後 往復20 + 実行5×10
  'a-tech-0253': (q) => {
    const before = (20 + 5) * 10;
    const after = 20 + 5 * 10;
    return pick(q, before - after);
  },
  // 3層構成のボトルネック：Web 2×300、AP 3×150、DB 400÷0.8
  'a-tech-0256': (q) => pick(q, Math.min(2 * 300, 3 * 150, 400 / 0.8)),
};
