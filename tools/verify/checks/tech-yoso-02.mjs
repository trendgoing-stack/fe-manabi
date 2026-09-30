import { pick } from '../lib/pick.mjs';

/** 問題の table を、見出しをキーにしたオブジェクトの配列にする */
const rowsOf = (q) =>
  q.table.rows.map((r) => Object.fromEntries(q.table.header.map((h, i) => [h, r[i]])));

/** "a.b.c.d" を32ビットの符号なし整数にする */
const toInt = (ip) => ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0);

/** アドレス addr が network/prefix に含まれるか */
const inNetwork = (addr, network, prefix) => {
  const size = 2 ** (32 - prefix);
  return Math.floor(toInt(addr) / size) === Math.floor(toInt(network) / size);
};

export const checks = {
  // 会員 LEFT OUTER JOIN 貸出 の結果行数（会員は問題文の M1〜M5）
  'a-tech-0107': (q) => {
    const members = ['M1', 'M2', 'M3', 'M4', 'M5'];
    const loans = rowsOf(q);
    let count = 0;
    for (const m of members) {
      const matched = loans.filter((l) => l['会員番号'] === m).length;
      count += matched === 0 ? 1 : matched;
    }
    return pick(q, count);
  },

  // 自己結合：上司より給与が高い社員の数（上司番号 NULL は結合されない）
  'a-tech-0112': (q) => {
    const rows = rowsOf(q);
    let count = 0;
    for (const a of rows) {
      for (const b of rows) {
        if (a['上司番号'] === 'NULL') continue;
        if (a['上司番号'] === b['社員番号'] && Number(a['給与']) > Number(b['給与'])) count++;
      }
    }
    return pick(q, count);
  },

  // /21 でホストに割り当てられるアドレス数
  'a-tech-0114': (q) => pick(q, 2 ** (32 - 21) - 2),

  // 誤りビット数の期待値 = 速度 × 時間 × ビット誤り率（2×10^-7 は整数演算で扱う）
  'a-tech-0115': (q) => {
    const bits = 25e6 * 4 * 60;
    return pick(q, (bits * 2) / 1e7);
  },

  // 回線利用率 = 1秒当たりの送信ビット数 ÷ 回線速度
  'a-tech-0116': (q) => {
    const bytesPerItem = (6000 * 120) / 100;
    const bitsPerSecond = (bytesPerItem * 8 * 9000) / 3600;
    return pick(q, (bitsPerSecond / 240000) * 100);
  },

  // 経路表の最長一致
  'a-tech-0119': (q) => {
    const dest = '10.20.112.9';
    let best = null;
    for (const r of rowsOf(q)) {
      const [network, p] = r['宛先ネットワーク'].split('/');
      const prefix = Number(p);
      if (inNetwork(dest, network, prefix) && (best === null || prefix > best.prefix)) {
        best = { prefix, next: r['転送先'] };
      }
    }
    return pick(q, best.next);
  },

  // パスワードの総数の比 52^8 ÷ 26^6
  'a-tech-0122': (q) => pick(q, Number(52n ** 8n / 26n ** 6n)),
};
