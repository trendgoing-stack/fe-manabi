// data/questions/a/tech-kiso-04.json の実行検証。
import { pick } from '../lib/pick.mjs';

const bigrams = (s) => {
  const a = [...s];
  const set = new Set();
  for (let i = 0; i + 2 <= a.length; i++) set.add(a[i] + a[i + 1]);
  return set;
};

export const checks = {
  // 後判定型の繰返し：x を2で割り続け、0になるまでの回数
  'a-tech-0274': (q) => {
    let c = 0;
    let x = 40;
    do {
      x = Math.floor(x / 2);
      c += 1;
    } while (x !== 0);
    return pick(q, String(c));
  },
  // バイグラムの集合による類似度（共通部分÷和集合）
  'a-tech-0276': (q) => {
    const a = bigrams('ゲームソフト');
    const b = bigrams('ソフトゲーム');
    const inter = [...a].filter((x) => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return pick(q, (inter / union).toFixed(2));
  },
  // RISC の CPU 時間＝命令数×CPI÷クロック周波数
  'a-tech-0284': (q) => {
    const n = 4e8 * 1.6;
    const cpi = 1.25;
    const hz = 2e9;
    return pick(q, ((n * cpi) / hz).toFixed(2));
  },
};
